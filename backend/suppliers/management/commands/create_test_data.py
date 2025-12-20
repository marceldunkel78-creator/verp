from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal
from suppliers.models import (
    Supplier, ProductGroup, PriceList,
    TradingProduct, Asset, MaterialSupply
)
from customers.models import Customer, CustomerAddress

User = get_user_model()


class Command(BaseCommand):
    help = 'Erstellt Testdaten für Lieferanten, Kunden und Produkte'

    def handle(self, *args, **kwargs):
        self.stdout.write('Erstelle Testdaten...\n')
        
        # Erstelle Testuser falls nicht vorhanden
        user = self._get_or_create_user()
        
        # Erstelle Lieferanten mit Adressen
        suppliers = self._create_suppliers(user)
        
        # Erstelle Warengruppen für jeden Lieferanten
        product_groups = self._create_product_groups(suppliers)
        
        # Erstelle Preislisten für Lieferanten
        price_lists = self._create_price_lists(suppliers)
        
        # Erstelle Handelswaren
        self._create_trading_products(suppliers, product_groups, price_lists, user)
        
        # Erstelle Material & Supplies
        self._create_material_supplies(suppliers, product_groups, price_lists, user)
        
        # Erstelle Assets
        self._create_assets(suppliers, product_groups, user)
        
        # Erstelle Kunden mit Adressen
        self._create_customers(user)
        
        self.stdout.write(self.style.SUCCESS('\n✅ Testdaten erfolgreich erstellt!'))

    def _get_or_create_user(self):
        """Holt oder erstellt einen Admin-User"""
        user = User.objects.filter(is_superuser=True).first()
        if not user:
            self.stdout.write(self.style.WARNING('Kein Superuser gefunden. Bitte erst einen erstellen.'))
            return None
        return user

    def _create_product_groups(self, suppliers):
        """Erstellt Warengruppen für jeden Lieferanten"""
        self.stdout.write('\nErstelle Warengruppen:')
        
        groups_data = {
            'Mikroskopie': 5.0,
            'Optik': 3.0,
            'Laborausstattung': 8.0,
            'Software': 0.0,
            'Chemikalien': 10.0,
            'Verbrauchsmaterial': 12.0,
            'Anlage': 0.0,
        }
        
        product_groups = {}
        for supplier in suppliers:
            product_groups[supplier.id] = {}
            for group_name, discount in groups_data.items():
                group, created = ProductGroup.objects.get_or_create(
                    supplier=supplier,
                    name=group_name,
                    defaults={'discount_percent': Decimal(str(discount))}
                )
                product_groups[supplier.id][group_name] = group
                if created:
                    self.stdout.write(f'  ✓ {supplier.company_name[:20]} - {group_name}')
        
        return product_groups

    def _create_suppliers(self, user):
        """Erstellt Lieferanten mit Bestelladressen"""
        suppliers_data = [
            {
                'company_name': 'Carl Zeiss Microscopy GmbH',
                'street': 'Carl-Zeiss-Promenade',
                'house_number': '10',
                'postal_code': '07745',
                'city': 'Jena',
                'country': 'DE',
                'email': 'orders@zeiss.com',
                'phone': '+49 3641 64-0',
            },
            {
                'company_name': 'Leica Microsystems GmbH',
                'street': 'Ernst-Leitz-Straße',
                'house_number': '17-37',
                'postal_code': '35578',
                'city': 'Wetzlar',
                'country': 'DE',
                'email': 'info@leica-microsystems.com',
                'phone': '+49 6441 29-0',
            },
            {
                'company_name': 'Olympus Europa SE & Co. KG',
                'street': 'Wendenstraße',
                'house_number': '14-18',
                'postal_code': '20097',
                'city': 'Hamburg',
                'country': 'DE',
                'email': 'orders@olympus.de',
                'phone': '+49 40 23773-0',
            },
            {
                'company_name': 'Nikon Instruments Europe B.V.',
                'street': 'Tripolis 100',
                'house_number': '',
                'postal_code': '1101 EB',
                'city': 'Amsterdam',
                'country': 'NL',
                'email': 'info@nikon-instruments.eu',
                'phone': '+31 20 44 96 222',
            },
            {
                'company_name': 'Thermo Fisher Scientific',
                'street': 'Dornierstraße',
                'house_number': '4',
                'postal_code': '82110',
                'city': 'Germering',
                'country': 'DE',
                'email': 'orders.germany@thermofisher.com',
                'phone': '+49 89 3681-0',
            },
        ]
        
        suppliers = []
        self.stdout.write('\nErstelle Lieferanten:')
        
        for supplier_data in suppliers_data:
            # Erstelle Lieferant
            supplier, created = Supplier.objects.get_or_create(
                company_name=supplier_data['company_name'],
                defaults={
                    **supplier_data,
                    'created_by': user,
                    'is_active': True
                }
            )
            
            if created:
                self.stdout.write(f'  ✓ {supplier.company_name} (#{supplier.supplier_number})')
                suppliers.append(supplier)
            else:
                self.stdout.write(f'  - {supplier.company_name} existiert bereits')
                suppliers.append(supplier)
        
        return suppliers

    def _create_price_lists(self, suppliers):
        """Erstellt Preislisten für Lieferanten"""
        from datetime import date
        price_lists = {}
        
        for supplier in suppliers:
            price_list, created = PriceList.objects.get_or_create(
                supplier=supplier,
                name=f'Standardpreisliste {supplier.company_name[:30]}',
                defaults={
                    'is_active': True,
                    'valid_from': date(2025, 1, 1)
                }
            )
            price_lists[supplier.id] = price_list
        
        return price_lists

    def _create_trading_products(self, suppliers, product_groups, price_lists, user):
        """Erstellt Handelswaren"""
        from datetime import date
        self.stdout.write('\nErstelle Handelswaren:')
        
        products_data = [
            {
                'supplier_idx': 0,  # Zeiss
                'name': 'Zeiss Axio Observer 3',
                'supplier_part_number': 'AO3-432100',
                'category': 'MICROSCOPES',
                'short_description': 'Invertiertes Mikroskop für Fluoreszenz',
                'list_price': Decimal('25000.00'),
                'discount_percent': Decimal('10.00'),
                'group': 'Mikroskopie'
            },
            {
                'supplier_idx': 0,  # Zeiss
                'name': 'Zeiss Plan-Apochromat 63x/1.40 Oil DIC',
                'supplier_part_number': 'ZPA-63140',
                'category': 'OBJECTIVES',
                'short_description': 'Objektiv für hochauflösende Mikroskopie',
                'list_price': Decimal('4500.00'),
                'discount_percent': Decimal('5.00'),
                'group': 'Optik'
            },
            {
                'supplier_idx': 1,  # Leica
                'name': 'Leica DM6000 B',
                'supplier_part_number': 'LDM-6000B',
                'category': 'MICROSCOPES',
                'short_description': 'Aufrechtes Forschungsmikroskop',
                'list_price': Decimal('32000.00'),
                'discount_percent': Decimal('12.00'),
                'group': 'Mikroskopie'
            },
            {
                'supplier_idx': 1,  # Leica
                'name': 'Leica HCX PL APO 40x/1.25 Oil',
                'supplier_part_number': 'LHC-40125',
                'category': 'OBJECTIVES',
                'short_description': 'Ölimmersionsobjektiv',
                'list_price': Decimal('3200.00'),
                'discount_percent': Decimal('8.00'),
                'group': 'Optik'
            },
            {
                'supplier_idx': 2,  # Olympus
                'name': 'Olympus IX73',
                'supplier_part_number': 'IX73-BASE',
                'category': 'MICROSCOPES',
                'short_description': 'Invertiertes Mikroskop',
                'list_price': Decimal('18000.00'),
                'discount_percent': Decimal('15.00'),
                'group': 'Mikroskopie'
            },
            {
                'supplier_idx': 3,  # Nikon
                'name': 'Nikon Eclipse Ti2',
                'supplier_part_number': 'NE-TI2',
                'category': 'MICROSCOPES',
                'short_description': 'Invertiertes Mikroskop mit motorisiertem Revolver',
                'list_price': Decimal('28000.00'),
                'discount_percent': Decimal('10.00'),
                'group': 'Mikroskopie'
            },
            {
                'supplier_idx': 4,  # Thermo Fisher
                'name': 'Thermo Scientific Forma Steri-Cycle CO2 Incubator',
                'supplier_part_number': 'TSC-371',
                'category': 'EQUIPMENT',
                'short_description': 'CO2-Inkubator für Zellkultur',
                'list_price': Decimal('8500.00'),
                'discount_percent': Decimal('5.00'),
                'group': 'Laborausstattung'
            },
        ]
        
        for product_data in products_data:
            supplier = suppliers[product_data.pop('supplier_idx')]
            group_name = product_data.pop('group')
            
            product, created = TradingProduct.objects.get_or_create(
                supplier=supplier,
                supplier_part_number=product_data['supplier_part_number'],
                defaults={
                    **product_data,
                    'product_group': product_groups[supplier.id][group_name],
                    'price_list': price_lists[supplier.id],
                    'list_price_currency': 'EUR',
                    'price_valid_from': date(2025, 1, 1)
                }
            )
            
            if created:
                self.stdout.write(f'  ✓ {product.name} ({product.visitron_part_number})')

    def _create_material_supplies(self, suppliers, product_groups, price_lists, user):
        """Erstellt Material & Supplies"""
        from datetime import date
        self.stdout.write('\nErstelle Material & Supplies:')
        
        ms_data = [
            {
                'supplier_idx': 4,  # Thermo Fisher
                'name': 'DMEM (Dulbecco\'s Modified Eagle Medium)',
                'supplier_part_number': 'TF-DMEM-500',
                'category': 'ROHSTOFF',
                'short_description': 'Zellkulturmedium, 500ml',
                'list_price': Decimal('45.00'),
                'discount_percent': Decimal('10.00'),
                'group': 'Chemikalien'
            },
            {
                'supplier_idx': 4,  # Thermo Fisher
                'name': 'PBS (Phosphate Buffered Saline)',
                'supplier_part_number': 'TF-PBS-1L',
                'category': 'HILFSSTOFF',
                'short_description': 'Phosphatgepufferte Salzlösung, 1L',
                'list_price': Decimal('25.00'),
                'discount_percent': Decimal('5.00'),
                'group': 'Chemikalien'
            },
            {
                'supplier_idx': 4,  # Thermo Fisher
                'name': 'Trypsin-EDTA 0.25%',
                'supplier_part_number': 'TF-TRYP-100',
                'category': 'ROHSTOFF',
                'short_description': 'Enzym für Zellablösung, 100ml',
                'list_price': Decimal('65.00'),
                'discount_percent': Decimal('8.00'),
                'group': 'Chemikalien'
            },
            {
                'supplier_idx': 2,  # Olympus
                'name': 'Immersionsöl Typ F',
                'supplier_part_number': 'OLY-IMMOIL-50',
                'category': 'BETRIEBSSTOFF',
                'short_description': 'Immersionsöl für Mikroskopie, 50ml',
                'list_price': Decimal('35.00'),
                'discount_percent': Decimal('0.00'),
                'group': 'Verbrauchsmaterial'
            },
            {
                'supplier_idx': 4,  # Thermo Fisher
                'name': 'Mikrotiterplatten 96-Well',
                'supplier_part_number': 'TF-MTP96-100',
                'category': 'HILFSSTOFF',
                'short_description': '96-Well Platten, steril, 100 Stück',
                'list_price': Decimal('120.00'),
                'discount_percent': Decimal('15.00'),
                'group': 'Verbrauchsmaterial'
            },
        ]
        
        for ms_item in ms_data:
            supplier = suppliers[ms_item.pop('supplier_idx')]
            group_name = ms_item.pop('group')
            
            material, created = MaterialSupply.objects.get_or_create(
                supplier=supplier,
                supplier_part_number=ms_item['supplier_part_number'],
                defaults={
                    **ms_item,
                    'product_group': product_groups[supplier.id][group_name],
                    'price_list': price_lists[supplier.id],
                    'list_price_currency': 'EUR',
                    'price_valid_from': date(2025, 1, 1)
                }
            )
            
            if created:
                self.stdout.write(f'  ✓ {material.name} ({material.visitron_part_number})')

    def _create_assets(self, suppliers, product_groups, user):
        """Erstellt Assets"""
        self.stdout.write('\nErstelle Assets:')
        
        from datetime import date, timedelta
        
        assets_data = [
            {
                'supplier_idx': 0,  # Zeiss
                'name': 'Zeiss LSM 880 Konfokalmikroskop',
                'supplier_part_number': 'ZL-880-2020',
                'serial_number': 'ZLS880-2020-00142',
                'short_description': 'Konfokalmikroskop mit Airyscan',
                'purchase_price': Decimal('185000.00'),
                'sale_price': Decimal('220000.00'),
                'purchase_date': date.today() - timedelta(days=365),
                'status': 'in_use',
                'group': 'Anlage'
            },
            {
                'supplier_idx': 1,  # Leica
                'name': 'Leica SP8 Konfokalmikroskop',
                'supplier_part_number': 'LSP8-2019',
                'serial_number': 'LSP8-2019-00087',
                'short_description': 'Spektrales Konfokalsystem',
                'purchase_price': Decimal('165000.00'),
                'sale_price': Decimal('195000.00'),
                'purchase_date': date.today() - timedelta(days=730),
                'status': 'in_use',
                'group': 'Anlage'
            },
            {
                'supplier_idx': 2,  # Olympus
                'name': 'Olympus FV3000 Konfokalmikroskop',
                'supplier_part_number': 'OFV-3000-2021',
                'serial_number': 'OFV3000-2021-00231',
                'short_description': 'Hochgeschwindigkeits-Konfokalsystem',
                'purchase_price': Decimal('145000.00'),
                'purchase_date': date.today() - timedelta(days=180),
                'status': 'in_transit',
                'group': 'Anlage'
            },
            {
                'supplier_idx': 3,  # Nikon
                'name': 'Nikon A1R HD25 Konfokalmikroskop',
                'supplier_part_number': 'NA1R-HD25-2022',
                'serial_number': 'NA1RHD-2022-00095',
                'short_description': 'Hochauflösendes Konfokalsystem',
                'purchase_price': Decimal('175000.00'),
                'sale_price': Decimal('210000.00'),
                'purchase_date': date.today() - timedelta(days=90),
                'status': 'ordered',
                'group': 'Anlage'
            },
        ]
        
        for asset_data in assets_data:
            supplier = suppliers[asset_data.pop('supplier_idx')]
            group_name = asset_data.pop('group')
            
            asset, created = Asset.objects.get_or_create(
                supplier=supplier,
                serial_number=asset_data['serial_number'],
                defaults={
                    **asset_data,
                    'product_group': product_groups[supplier.id][group_name],
                    'purchase_currency': 'EUR'
                }
            )
            
            if created:
                self.stdout.write(f'  ✓ {asset.name} ({asset.visitron_part_number})')

    def _create_customers(self, user):
        """Erstellt Kunden mit Adressen"""
        self.stdout.write('\nErstelle Kunden:')
        
        customers_data = [
            {
                'title': 'Prof. Dr.',
                'first_name': 'Anna',
                'last_name': 'Müller',
                'language': 'DE',
                'university': 'Ludwig-Maximilians-Universität München',
                'institute': 'Biozentrum',
                'department': 'Lehrstuhl für Zellbiologie',
                'street': 'Großhaderner Straße',
                'house_number': '2',
                'postal_code': '82152',
                'city': 'Planegg-Martinsried',
                'country': 'DE'
            },
            {
                'title': 'Dr.',
                'first_name': 'Thomas',
                'last_name': 'Schmidt',
                'language': 'DE',
                'university': 'Technische Universität München',
                'institute': 'Fakultät für Chemie',
                'department': 'Institut für Organische Chemie',
                'street': 'Lichtenbergstraße',
                'house_number': '4',
                'postal_code': '85748',
                'city': 'Garching',
                'country': 'DE'
            },
            {
                'title': 'Prof. Dr.',
                'first_name': 'Sarah',
                'last_name': 'Weber',
                'language': 'DE',
                'university': 'Universität Heidelberg',
                'institute': 'Zentrum für Molekulare Biologie',
                'department': 'Abteilung Entwicklungsbiologie',
                'street': 'Im Neuenheimer Feld',
                'house_number': '282',
                'postal_code': '69120',
                'city': 'Heidelberg',
                'country': 'DE'
            },
            {
                'title': 'Dr.',
                'first_name': 'Michael',
                'last_name': 'Fischer',
                'language': 'DE',
                'university': 'Max-Planck-Institut für Biochemie',
                'institute': 'Abteilung Molekularbiologie',
                'department': 'Strukturbiologie',
                'street': 'Am Klopferspitz',
                'house_number': '18',
                'postal_code': '82152',
                'city': 'Martinsried',
                'country': 'DE'
            },
            {
                'title': 'Prof.',
                'first_name': 'Julia',
                'last_name': 'Wagner',
                'language': 'DE',
                'university': 'Universität zu Köln',
                'institute': 'Biozentrum',
                'department': 'Institut für Genetik',
                'street': 'Zülpicher Straße',
                'house_number': '47a',
                'postal_code': '50674',
                'city': 'Köln',
                'country': 'DE'
            },
            {
                'title': 'Dr.',
                'first_name': 'Martin',
                'last_name': 'Becker',
                'language': 'DE',
                'university': 'Charité - Universitätsmedizin Berlin',
                'institute': 'Institut für Medizinische Immunologie',
                'department': 'Experimentelle Immunologie',
                'street': 'Augustenburger Platz',
                'house_number': '1',
                'postal_code': '13353',
                'city': 'Berlin',
                'country': 'DE'
            },
            {
                'title': 'Prof. Dr.',
                'first_name': 'Claudia',
                'last_name': 'Meyer',
                'language': 'DE',
                'university': 'Universität Hamburg',
                'institute': 'Fakultät für Mathematik, Informatik und Naturwissenschaften',
                'department': 'Institut für Biochemie und Molekularbiologie',
                'street': 'Martin-Luther-King-Platz',
                'house_number': '6',
                'postal_code': '20146',
                'city': 'Hamburg',
                'country': 'DE'
            },
            {
                'title': 'Dr.',
                'first_name': 'Andreas',
                'last_name': 'Hoffmann',
                'language': 'DE',
                'university': 'Friedrich-Schiller-Universität Jena',
                'institute': 'Biologisch-Pharmazeutische Fakultät',
                'department': 'Institut für Molekulare Zellbiologie',
                'street': 'Fürstengraben',
                'house_number': '1',
                'postal_code': '07743',
                'city': 'Jena',
                'country': 'DE'
            },
            {
                'title': 'Prof.',
                'first_name': 'Lisa',
                'last_name': 'Schäfer',
                'language': 'EN',
                'university': 'ETH Zürich',
                'institute': 'Department of Biology',
                'department': 'Institute of Molecular Systems Biology',
                'street': 'Otto-Stern-Weg',
                'house_number': '3',
                'postal_code': '8093',
                'city': 'Zürich',
                'country': 'CH'
            },
            {
                'title': 'Dr.',
                'first_name': 'Robert',
                'last_name': 'Koch',
                'language': 'DE',
                'university': 'Universität Wien',
                'institute': 'Fakultät für Lebenswissenschaften',
                'department': 'Department für Strukturbiologie und Computational Biology',
                'street': 'Campus Vienna Biocenter',
                'house_number': '5',
                'postal_code': '1030',
                'city': 'Wien',
                'country': 'AT'
            },
            {
                'title': 'Prof. Dr.',
                'first_name': 'Petra',
                'last_name': 'Zimmermann',
                'language': 'DE',
                'university': 'Universität Göttingen',
                'institute': 'Fakultät für Biologie und Psychologie',
                'department': 'Institut für Mikrobiologie und Genetik',
                'street': 'Grisebachstraße',
                'house_number': '8',
                'postal_code': '37077',
                'city': 'Göttingen',
                'country': 'DE'
            },
            {
                'title': 'Dr.',
                'first_name': 'Stefan',
                'last_name': 'Braun',
                'language': 'EN',
                'university': 'University of Cambridge',
                'institute': 'Department of Biochemistry',
                'department': 'Structural Biology Laboratory',
                'street': 'Tennis Court Road',
                'house_number': '80',
                'postal_code': 'CB2 1GA',
                'city': 'Cambridge',
                'country': 'GB'
            },
        ]
        
        for customer_data in customers_data:
            # Extrahiere Adressdaten
            address_data = {
                'university': customer_data.pop('university'),
                'institute': customer_data.pop('institute'),
                'department': customer_data.pop('department'),
                'street': customer_data.pop('street'),
                'house_number': customer_data.pop('house_number'),
                'postal_code': customer_data.pop('postal_code'),
                'city': customer_data.pop('city'),
                'country': customer_data.pop('country'),
            }
            
            # Erstelle Kunde
            customer, created = Customer.objects.get_or_create(
                first_name=customer_data['first_name'],
                last_name=customer_data['last_name'],
                defaults={
                    **customer_data,
                    'created_by': user,
                    'is_active': True
                }
            )
            
            if created:
                # Erstelle Office-Adresse
                CustomerAddress.objects.create(
                    customer=customer,
                    address_type='Office',
                    **address_data
                )
                self.stdout.write(f'  ✓ {customer.title} {customer.first_name} {customer.last_name} ({customer.customer_number})')
            else:
                self.stdout.write(f'  - {customer.title} {customer.first_name} {customer.last_name} existiert bereits')
