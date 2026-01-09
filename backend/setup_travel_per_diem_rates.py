#!/usr/bin/env python
"""
Setup script to populate German travel per-diem rates (Verpflegungspauschalen)
Based on German tax law (§ 9 EStG) - rates as of 2026

Quelle: BMF-Schreiben vom 2. Dezember 2024
BStBl I 2024 S. 1549, GZ: IV C 5 - S 2353/00094/007/012

Offizielle Quelle:
https://www.bundesfinanzministerium.de
→ Steuerarten → Lohnsteuer → Reisekosten → Auslandsreisekosten
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'verp.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from users.models import TravelPerDiemRate
from decimal import Decimal
from datetime import date

# German per-diem rates 2026 (Verpflegungspauschalen nach deutschem Steuerrecht)
# Source: BMF-Schreiben vom 2. Dezember 2024 (BStBl I 2024 S. 1549)
# Model fields: country, country_code, full_day_rate, partial_day_rate, overnight_rate
#
# WICHTIG: Diese Werte basieren auf dem offiziellen BMF-Schreiben vom 02.12.2024
# (BStBl I 2024 S. 1549). Die folgende Liste enthält Länder- und städtespezifische
# Pauschalen ab 01.01.2026. 'city' == None bedeutet "im Übrigen" (länderweiter Satz).
RATES_2026 = [
    {'country': 'Ägypten', 'city': None, 'country_code': '', 'full_day_rate': Decimal('50.00'), 'partial_day_rate': Decimal('33.00'), 'overnight_rate': Decimal('112.00')},
    {'country': 'Äthiopien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('159.00')},
    {'country': 'Äquatorialguinea', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('166.00')},
    {'country': 'Albanien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('116.00')},
    {'country': 'Algerien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('47.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('120.00')},
    {'country': 'Andorra', 'city': None, 'country_code': '', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('135.00')},
    {'country': 'Angola', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('368.00')},
    {'country': 'Argentinien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('119.00')},
    {'country': 'Armenien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('29.00'), 'partial_day_rate': Decimal('20.00'), 'overnight_rate': Decimal('107.00')},
    {'country': 'Aserbaidschan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('88.00')},
    {'country': 'Australien', 'city': 'Canberra', 'country_code': '', 'full_day_rate': Decimal('74.00'), 'partial_day_rate': Decimal('49.00'), 'overnight_rate': Decimal('186.00')},
    {'country': 'Australien', 'city': 'Sydney', 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('173.00')},
    {'country': 'Australien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('173.00')},
    {'country': 'Bahrain', 'city': None, 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('153.00')},
    {'country': 'Bangladesch', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('189.00')},
    {'country': 'Barbados', 'city': None, 'country_code': '', 'full_day_rate': Decimal('54.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('206.00')},
    {'country': 'Belgien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('141.00')},
    {'country': 'Benin', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('168.00')},
    {'country': 'Bhutan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('27.00'), 'partial_day_rate': Decimal('18.00'), 'overnight_rate': Decimal('176.00')},
    {'country': 'Bolivien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('108.00')},
    {'country': 'Bosnien und Herzegowina', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('109.00')},
    {'country': 'Botsuana', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('105.00')},
    {'country': 'Brasilien', 'city': 'Brasilia', 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('88.00')},
    {'country': 'Brasilien', 'city': 'Rio de Janeiro', 'country_code': '', 'full_day_rate': Decimal('69.00'), 'partial_day_rate': Decimal('46.00'), 'overnight_rate': Decimal('140.00')},
    {'country': 'Brasilien', 'city': 'Sao Paulo', 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('151.00')},
    {'country': 'Brasilien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('88.00')},
    {'country': 'Brunei', 'city': None, 'country_code': '', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('110.00')},
    {'country': 'Bulgarien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('38.00'), 'partial_day_rate': Decimal('25.00'), 'overnight_rate': Decimal('109.00')},
    {'country': 'Burkina Faso', 'city': None, 'country_code': '', 'full_day_rate': Decimal('39.00'), 'partial_day_rate': Decimal('26.00'), 'overnight_rate': Decimal('230.00')},
    {'country': 'Burundi', 'city': None, 'country_code': '', 'full_day_rate': Decimal('58.00'), 'partial_day_rate': Decimal('39.00'), 'overnight_rate': Decimal('102.00')},
    {'country': 'Chile', 'city': None, 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('154.00')},
    {'country': 'China', 'city': 'Hongkong', 'country_code': '', 'full_day_rate': Decimal('83.00'), 'partial_day_rate': Decimal('56.00'), 'overnight_rate': Decimal('209.00')},
    {'country': 'China', 'city': 'Peking', 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('184.00')},
    {'country': 'China', 'city': 'Shanghai', 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('142.00')},
    {'country': 'China', 'city': None, 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('142.00')},
    {'country': 'Costa Rica', 'city': None, 'country_code': '', 'full_day_rate': Decimal('60.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('127.00')},
    {'country': 'Côte d’Ivoire', 'city': None, 'country_code': '', 'full_day_rate': Decimal('60.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('171.00')},
    {'country': 'Dänemark', 'city': None, 'country_code': '', 'full_day_rate': Decimal('75.00'), 'partial_day_rate': Decimal('50.00'), 'overnight_rate': Decimal('183.00')},
    {'country': 'Dominikanische Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('50.00'), 'partial_day_rate': Decimal('33.00'), 'overnight_rate': Decimal('167.00')},
    {'country': 'Dschibuti', 'city': None, 'country_code': '', 'full_day_rate': Decimal('77.00'), 'partial_day_rate': Decimal('52.00'), 'overnight_rate': Decimal('255.00')},
    {'country': 'Ecuador', 'city': None, 'country_code': '', 'full_day_rate': Decimal('27.00'), 'partial_day_rate': Decimal('18.00'), 'overnight_rate': Decimal('103.00')},
    {'country': 'El Salvador', 'city': None, 'country_code': '', 'full_day_rate': Decimal('65.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('161.00')},
    {'country': 'Eritrea', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('78.00')},
    {'country': 'Estland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('39.00'), 'partial_day_rate': Decimal('26.00'), 'overnight_rate': Decimal('125.00')},
    {'country': 'Fidschi', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('183.00')},
    {'country': 'Finnland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('54.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('171.00')},
    {'country': 'Frankreich', 'city': 'Paris sowie die Departments 77, 78, 91 bis 95', 'country_code': '', 'full_day_rate': Decimal('58.00'), 'partial_day_rate': Decimal('39.00'), 'overnight_rate': Decimal('159.00')},
    {'country': 'Frankreich', 'city': None, 'country_code': '', 'full_day_rate': Decimal('53.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('105.00')},
    {'country': 'Gabun', 'city': None, 'country_code': '', 'full_day_rate': Decimal('64.00'), 'partial_day_rate': Decimal('43.00'), 'overnight_rate': Decimal('263.00')},
    {'country': 'Gambia', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('161.00')},
    {'country': 'Georgien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('87.00')},
    {'country': 'Ghana', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('203.00')},
    {'country': 'Griechenland', 'city': 'Athen', 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('139.00')},
    {'country': 'Griechenland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('150.00')},
    {'country': 'Guatemala', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('124.00')},
    {'country': 'Guinea', 'city': None, 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('140.00')},
    {'country': 'Guinea-Bissau', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('113.00')},
    {'country': 'Honduras', 'city': None, 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('198.00')},
    {'country': 'Indien', 'city': 'Bangalore', 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('155.00')},
    {'country': 'Indien', 'city': 'Chennai', 'country_code': '', 'full_day_rate': Decimal('22.00'), 'partial_day_rate': Decimal('15.00'), 'overnight_rate': Decimal('80.00')},
    {'country': 'Indien', 'city': 'Kalkutta', 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('167.00')},
    {'country': 'Indien', 'city': 'Mumbai', 'country_code': '', 'full_day_rate': Decimal('53.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('218.00')},
    {'country': 'Indien', 'city': 'Neu Delhi', 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('211.00')},
    {'country': 'Indien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('22.00'), 'partial_day_rate': Decimal('15.00'), 'overnight_rate': Decimal('80.00')},
    {'country': 'Indonesien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('179.00')},
    {'country': 'Iran', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('196.00')},
    {'country': 'Irland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('64.00'), 'partial_day_rate': Decimal('43.00'), 'overnight_rate': Decimal('164.00')},
    {'country': 'Island', 'city': None, 'country_code': '', 'full_day_rate': Decimal('62.00'), 'partial_day_rate': Decimal('41.00'), 'overnight_rate': Decimal('187.00')},
    {'country': 'Israel', 'city': None, 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('268.00')},
    {'country': 'Italien', 'city': 'Mailand', 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('191.00')},
    {'country': 'Italien', 'city': 'Rom', 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('150.00')},
    {'country': 'Italien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('150.00')},
    {'country': 'Jamaika', 'city': None, 'country_code': '', 'full_day_rate': Decimal('39.00'), 'partial_day_rate': Decimal('26.00'), 'overnight_rate': Decimal('171.00')},
    {'country': 'Japan', 'city': 'Tokio', 'country_code': '', 'full_day_rate': Decimal('50.00'), 'partial_day_rate': Decimal('33.00'), 'overnight_rate': Decimal('285.00')},
    {'country': 'Japan', 'city': 'Osaka', 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('141.00')},
    {'country': 'Japan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('141.00')},
    {'country': 'Jordanien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('134.00')},
    {'country': 'Kambodscha', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('108.00')},
    {'country': 'Kamerun', 'city': None, 'country_code': '', 'full_day_rate': Decimal('56.00'), 'partial_day_rate': Decimal('37.00'), 'overnight_rate': Decimal('275.00')},
    {'country': 'Kanada', 'city': 'Ottawa', 'country_code': '', 'full_day_rate': Decimal('62.00'), 'partial_day_rate': Decimal('41.00'), 'overnight_rate': Decimal('214.00')},
    {'country': 'Kanada', 'city': 'Toronto', 'country_code': '', 'full_day_rate': Decimal('54.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('392.00')},
    {'country': 'Kanada', 'city': 'Vancouver', 'country_code': '', 'full_day_rate': Decimal('63.00'), 'partial_day_rate': Decimal('42.00'), 'overnight_rate': Decimal('304.00')},
    {'country': 'Kanada', 'city': None, 'country_code': '', 'full_day_rate': Decimal('54.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('214.00')},
    {'country': 'Kap Verde', 'city': None, 'country_code': '', 'full_day_rate': Decimal('38.00'), 'partial_day_rate': Decimal('25.00'), 'overnight_rate': Decimal('90.00')},
    {'country': 'Kasachstan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('108.00')},
    {'country': 'Katar', 'city': None, 'country_code': '', 'full_day_rate': Decimal('81.00'), 'partial_day_rate': Decimal('54.00'), 'overnight_rate': Decimal('128.00')},
    {'country': 'Kenia', 'city': None, 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('217.00')},
    {'country': 'Kirgisistan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('35.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('80.00')},
    {'country': 'Kolumbien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('123.00')},
    {'country': 'Kongo Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('53.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('215.00')},
    {'country': 'Kongo Demokratische Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('65.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('337.00')},
    {'country': 'Korea Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('39.00'), 'partial_day_rate': Decimal('26.00'), 'overnight_rate': Decimal('130.00')},
    {'country': 'Kosovo', 'city': None, 'country_code': '', 'full_day_rate': Decimal('24.00'), 'partial_day_rate': Decimal('16.00'), 'overnight_rate': Decimal('71.00')},
    {'country': 'Kroatien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('191.00')},
    {'country': 'Kuba', 'city': None, 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('170.00')},
    {'country': 'Kuwait', 'city': None, 'country_code': '', 'full_day_rate': Decimal('63.00'), 'partial_day_rate': Decimal('42.00'), 'overnight_rate': Decimal('224.00')},
    {'country': 'Laos', 'city': None, 'country_code': '', 'full_day_rate': Decimal('35.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('71.00')},
    {'country': 'Lesotho', 'city': None, 'country_code': '', 'full_day_rate': Decimal('28.00'), 'partial_day_rate': Decimal('19.00'), 'overnight_rate': Decimal('104.00')},
    {'country': 'Lettland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('119.00')},
    {'country': 'Libanon', 'city': None, 'country_code': '', 'full_day_rate': Decimal('69.00'), 'partial_day_rate': Decimal('46.00'), 'overnight_rate': Decimal('146.00')},
    {'country': 'Liberia', 'city': None, 'country_code': '', 'full_day_rate': Decimal('65.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('173.00')},
    {'country': 'Liechtenstein', 'city': None, 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('234.00')},
    {'country': 'Litauen', 'city': None, 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('124.00')},
    {'country': 'Luxemburg', 'city': None, 'country_code': '', 'full_day_rate': Decimal('63.00'), 'partial_day_rate': Decimal('42.00'), 'overnight_rate': Decimal('139.00')},
    {'country': 'Madagaskar', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('116.00')},
    {'country': 'Malawi', 'city': None, 'country_code': '', 'full_day_rate': Decimal('41.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('109.00')},
    {'country': 'Malaysia', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('86.00')},
    {'country': 'Malediven', 'city': None, 'country_code': '', 'full_day_rate': Decimal('70.00'), 'partial_day_rate': Decimal('47.00'), 'overnight_rate': Decimal('200.00')},
    {'country': 'Mali', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('141.00')},
    {'country': 'Malta', 'city': None, 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('191.00')},
    {'country': 'Marokko', 'city': None, 'country_code': '', 'full_day_rate': Decimal('41.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('87.00')},
    {'country': 'Marshall Inseln', 'city': None, 'country_code': '', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('112.00')},
    {'country': 'Mauretanien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('35.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('86.00')},
    {'country': 'Mauritius', 'city': None, 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('172.00')},
    {'country': 'Mexiko', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('337.00')},
    {'country': 'Moldau Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('26.00'), 'partial_day_rate': Decimal('17.00'), 'overnight_rate': Decimal('73.00')},
    {'country': 'Monaco', 'city': None, 'country_code': '', 'full_day_rate': Decimal('52.00'), 'partial_day_rate': Decimal('35.00'), 'overnight_rate': Decimal('187.00')},
    {'country': 'Mongolei', 'city': None, 'country_code': '', 'full_day_rate': Decimal('23.00'), 'partial_day_rate': Decimal('16.00'), 'overnight_rate': Decimal('92.00')},
    {'country': 'Montenegro', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('85.00')},
    {'country': 'Mosambik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('208.00')},
    {'country': 'Myanmar', 'city': None, 'country_code': '', 'full_day_rate': Decimal('23.00'), 'partial_day_rate': Decimal('16.00'), 'overnight_rate': Decimal('103.00')},
    {'country': 'Namibia', 'city': None, 'country_code': '', 'full_day_rate': Decimal('28.00'), 'partial_day_rate': Decimal('19.00'), 'overnight_rate': Decimal('146.00')},
    {'country': 'Nepal', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('125.00')},
    {'country': 'Neuseeland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('58.00'), 'partial_day_rate': Decimal('39.00'), 'overnight_rate': Decimal('148.00')},
    {'country': 'Nicaragua', 'city': None, 'country_code': '', 'full_day_rate': Decimal('46.00'), 'partial_day_rate': Decimal('31.00'), 'overnight_rate': Decimal('105.00')},
    {'country': 'Niederlande', 'city': None, 'country_code': '', 'full_day_rate': Decimal('58.00'), 'partial_day_rate': Decimal('39.00'), 'overnight_rate': Decimal('167.00')},
    {'country': 'Niger', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('131.00')},
    {'country': 'Nigeria', 'city': None, 'country_code': '', 'full_day_rate': Decimal('52.00'), 'partial_day_rate': Decimal('35.00'), 'overnight_rate': Decimal('202.00')},
    {'country': 'Nordmazedonien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('27.00'), 'partial_day_rate': Decimal('18.00'), 'overnight_rate': Decimal('89.00')},
    {'country': 'Norwegen', 'city': None, 'country_code': '', 'full_day_rate': Decimal('75.00'), 'partial_day_rate': Decimal('50.00'), 'overnight_rate': Decimal('139.00')},
    {'country': 'Österreich', 'city': None, 'country_code': '', 'full_day_rate': Decimal('50.00'), 'partial_day_rate': Decimal('33.00'), 'overnight_rate': Decimal('117.00')},
    {'country': 'Oman', 'city': None, 'country_code': '', 'full_day_rate': Decimal('64.00'), 'partial_day_rate': Decimal('43.00'), 'overnight_rate': Decimal('141.00')},
    {'country': 'Pakistan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('41.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('199.00')},
    {'country': 'Palau', 'city': None, 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('193.00')},
    {'country': 'Panama', 'city': None, 'country_code': '', 'full_day_rate': Decimal('41.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('82.00')},
    {'country': 'Papua-Neuguinea', 'city': None, 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('159.00')},
    {'country': 'Paraguay', 'city': None, 'country_code': '', 'full_day_rate': Decimal('39.00'), 'partial_day_rate': Decimal('26.00'), 'overnight_rate': Decimal('124.00')},
    {'country': 'Peru', 'city': None, 'country_code': '', 'full_day_rate': Decimal('52.00'), 'partial_day_rate': Decimal('35.00'), 'overnight_rate': Decimal('128.00')},
    {'country': 'Philippinen', 'city': None, 'country_code': '', 'full_day_rate': Decimal('41.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('140.00')},
    {'country': 'Polen', 'city': 'Breslau', 'country_code': '', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('124.00')},
    {'country': 'Polen', 'city': 'Warschau', 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('143.00')},
    {'country': 'Polen', 'city': None, 'country_code': '', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('124.00')},
    {'country': 'Portugal', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('111.00')},
    {'country': 'Ruanda', 'city': None, 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('117.00')},
    {'country': 'Rumänien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('38.00'), 'partial_day_rate': Decimal('25.00'), 'overnight_rate': Decimal('103.00')},
    {'country': 'Russische Föderation', 'city': 'Moskau', 'country_code': '', 'full_day_rate': Decimal('30.00'), 'partial_day_rate': Decimal('20.00'), 'overnight_rate': Decimal('235.00')},
    {'country': 'Russische Föderation', 'city': 'St. Petersburg', 'country_code': '', 'full_day_rate': Decimal('28.00'), 'partial_day_rate': Decimal('19.00'), 'overnight_rate': Decimal('133.00')},
    {'country': 'Russische Föderation', 'city': None, 'country_code': '', 'full_day_rate': Decimal('28.00'), 'partial_day_rate': Decimal('19.00'), 'overnight_rate': Decimal('133.00')},
    {'country': 'Sambia', 'city': None, 'country_code': '', 'full_day_rate': Decimal('38.00'), 'partial_day_rate': Decimal('25.00'), 'overnight_rate': Decimal('105.00')},
    {'country': 'Samoa', 'city': None, 'country_code': '', 'full_day_rate': Decimal('39.00'), 'partial_day_rate': Decimal('26.00'), 'overnight_rate': Decimal('105.00')},
    {'country': 'San Marino', 'city': None, 'country_code': '', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('79.00')},
    {'country': 'São Tomé und Príncipe', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('147.00')},
    {'country': 'Saudi-Arabien', 'city': 'Djidda', 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('181.00')},
    {'country': 'Saudi-Arabien', 'city': 'Riad', 'country_code': '', 'full_day_rate': Decimal('56.00'), 'partial_day_rate': Decimal('37.00'), 'overnight_rate': Decimal('186.00')},
    {'country': 'Saudi-Arabien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('56.00'), 'partial_day_rate': Decimal('37.00'), 'overnight_rate': Decimal('181.00')},
    {'country': 'Schweden', 'city': None, 'country_code': '', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('140.00')},
    {'country': 'Schweiz', 'city': 'Bern', 'country_code': '', 'full_day_rate': Decimal('82.00'), 'partial_day_rate': Decimal('55.00'), 'overnight_rate': Decimal('195.00')},
    {'country': 'Schweiz', 'city': 'Genf', 'country_code': '', 'full_day_rate': Decimal('70.00'), 'partial_day_rate': Decimal('47.00'), 'overnight_rate': Decimal('197.00')},
    {'country': 'Schweiz', 'city': None, 'country_code': '', 'full_day_rate': Decimal('70.00'), 'partial_day_rate': Decimal('47.00'), 'overnight_rate': Decimal('195.00')},
    {'country': 'Senegal', 'city': None, 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('160.00')},
    {'country': 'Serbien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('27.00'), 'partial_day_rate': Decimal('18.00'), 'overnight_rate': Decimal('97.00')},
    {'country': 'Sierra Leone', 'city': None, 'country_code': '', 'full_day_rate': Decimal('57.00'), 'partial_day_rate': Decimal('38.00'), 'overnight_rate': Decimal('145.00')},
    {'country': 'Simbabwe', 'city': None, 'country_code': '', 'full_day_rate': Decimal('63.00'), 'partial_day_rate': Decimal('42.00'), 'overnight_rate': Decimal('198.00')},
    {'country': 'Singapur', 'city': None, 'country_code': '', 'full_day_rate': Decimal('71.00'), 'partial_day_rate': Decimal('48.00'), 'overnight_rate': Decimal('277.00')},
    {'country': 'Slowakische Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('121.00')},
    {'country': 'Slowenien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('38.00'), 'partial_day_rate': Decimal('25.00'), 'overnight_rate': Decimal('126.00')},
    {'country': 'Spanien', 'city': 'Barcelona', 'country_code': '', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('144.00')},
    {'country': 'Spanien', 'city': 'Kanarische Inseln', 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('103.00')},
    {'country': 'Spanien', 'city': 'Madrid', 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('131.00')},
    {'country': 'Spanien', 'city': 'Palma de Mallorca', 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('142.00')},
    {'country': 'Spanien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('34.00'), 'partial_day_rate': Decimal('23.00'), 'overnight_rate': Decimal('112.00')},
    {'country': 'Sri Lanka', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('130.00')},
    {'country': 'Südafrika', 'city': 'Kapstadt', 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('129.00')},
    {'country': 'Südafrika', 'city': 'Johannesburg', 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('109.00')},
    {'country': 'Südafrika', 'city': None, 'country_code': '', 'full_day_rate': Decimal('29.00'), 'partial_day_rate': Decimal('20.00'), 'overnight_rate': Decimal('159.00')},
    {'country': 'Südsudan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('85.00')},
    {'country': 'Tadschikistan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('27.00'), 'partial_day_rate': Decimal('18.00'), 'overnight_rate': Decimal('174.00')},
    {'country': 'Taiwan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('97.00')},
    {'country': 'Tansania', 'city': None, 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('114.00')},
    {'country': 'Thailand', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('144.00')},
    {'country': 'Togo', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('102.00')},
    {'country': 'Tonga', 'city': None, 'country_code': '', 'full_day_rate': Decimal('29.00'), 'partial_day_rate': Decimal('20.00'), 'overnight_rate': Decimal('203.00')},
    {'country': 'Trinidad und Tobago', 'city': None, 'country_code': '', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('155.00')},
    {'country': 'Tschad', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('77.00')},
    {'country': 'Tschechische Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('110.00')},
    {'country': 'Türkei', 'city': 'Ankara', 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('110.00')},
    {'country': 'Türkei', 'city': 'Izmir', 'country_code': '', 'full_day_rate': Decimal('44.00'), 'partial_day_rate': Decimal('29.00'), 'overnight_rate': Decimal('120.00')},
    {'country': 'Türkei', 'city': None, 'country_code': '', 'full_day_rate': Decimal('24.00'), 'partial_day_rate': Decimal('16.00'), 'overnight_rate': Decimal('107.00')},
    {'country': 'Tunesien', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('144.00')},
    {'country': 'Turkmenistan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('28.00'), 'partial_day_rate': Decimal('19.00'), 'overnight_rate': Decimal('135.00')},
    {'country': 'Uganda', 'city': None, 'country_code': '', 'full_day_rate': Decimal('45.00'), 'partial_day_rate': Decimal('30.00'), 'overnight_rate': Decimal('207.00')},
    {'country': 'Ukraine', 'city': None, 'country_code': '', 'full_day_rate': Decimal('33.00'), 'partial_day_rate': Decimal('22.00'), 'overnight_rate': Decimal('85.00')},
    {'country': 'Ungarn', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('113.00')},
    {'country': 'Uruguay', 'city': None, 'country_code': '', 'full_day_rate': Decimal('40.00'), 'partial_day_rate': Decimal('27.00'), 'overnight_rate': Decimal('133.00')},
    {'country': 'Usbekistan', 'city': None, 'country_code': '', 'full_day_rate': Decimal('32.00'), 'partial_day_rate': Decimal('21.00'), 'overnight_rate': Decimal('150.00')},
    {'country': 'Vatikanstaat', 'city': None, 'country_code': '', 'full_day_rate': Decimal('48.00'), 'partial_day_rate': Decimal('32.00'), 'overnight_rate': Decimal('178.00')},
    {'country': 'Venezuela', 'city': None, 'country_code': '', 'full_day_rate': Decimal('51.00'), 'partial_day_rate': Decimal('34.00'), 'overnight_rate': Decimal('169.00')},
    {'country': 'Vereinigte Arabische Emirate', 'city': None, 'country_code': '', 'full_day_rate': Decimal('81.00'), 'partial_day_rate': Decimal('54.00'), 'overnight_rate': Decimal('182.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Atlanta', 'country_code': '', 'full_day_rate': Decimal('77.00'), 'partial_day_rate': Decimal('52.00'), 'overnight_rate': Decimal('333.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Boston', 'country_code': '', 'full_day_rate': Decimal('63.00'), 'partial_day_rate': Decimal('42.00'), 'overnight_rate': Decimal('233.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Chicago', 'country_code': '', 'full_day_rate': Decimal('65.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('204.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Houston', 'country_code': '', 'full_day_rate': Decimal('62.00'), 'partial_day_rate': Decimal('41.00'), 'overnight_rate': Decimal('262.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Los Angeles', 'country_code': '', 'full_day_rate': Decimal('64.00'), 'partial_day_rate': Decimal('43.00'), 'overnight_rate': Decimal('256.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Miami', 'country_code': '', 'full_day_rate': Decimal('65.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('308.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'New York City', 'country_code': '', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('327.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'San Francisco', 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('203.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': 'Washington D. C.', 'country_code': '', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('203.00')},
    {'country': 'Vereinigte Staaten von Amerika (USA)', 'city': None, 'country_code': '', 'full_day_rate': Decimal('59.00'), 'partial_day_rate': Decimal('40.00'), 'overnight_rate': Decimal('182.00')},
    {'country': 'Vereinigtes Königreich von Großbritannien und Nordirland', 'city': 'London', 'country_code': '', 'full_day_rate': Decimal('66.00'), 'partial_day_rate': Decimal('44.00'), 'overnight_rate': Decimal('163.00')},
    {'country': 'Vereinigtes Königreich von Großbritannien und Nordirland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('52.00'), 'partial_day_rate': Decimal('35.00'), 'overnight_rate': Decimal('99.00')},
    {'country': 'Vietnam', 'city': None, 'country_code': '', 'full_day_rate': Decimal('36.00'), 'partial_day_rate': Decimal('24.00'), 'overnight_rate': Decimal('111.00')},
    {'country': 'Weißrussland', 'city': None, 'country_code': '', 'full_day_rate': Decimal('21.00'), 'partial_day_rate': Decimal('14.00'), 'overnight_rate': Decimal('148.00')},
    {'country': 'Zentralafrikanische Republik', 'city': None, 'country_code': '', 'full_day_rate': Decimal('53.00'), 'partial_day_rate': Decimal('36.00'), 'overnight_rate': Decimal('210.00')},
    {'country': 'Zypern', 'city': None, 'country_code': '', 'full_day_rate': Decimal('42.00'), 'partial_day_rate': Decimal('28.00'), 'overnight_rate': Decimal('125.00')},
]



def setup_per_diem_rates():
    """Create or update per-diem rates for 2026 (including cities)"""
    valid_from = date(2026, 1, 1)
    created_count = 0
    updated_count = 0

    # Deactivate older active rates (set valid_until)
    old_active = TravelPerDiemRate.objects.filter(is_active=True).exclude(valid_from=valid_from)
    if old_active.exists():
        cnt = old_active.count()
        print(f"Deactivating {cnt} old active rate(s)...")
        old_active.update(is_active=False, valid_until=date(2025, 12, 31))

    for rate_data in RATES_2026:
        city = rate_data.get('city')
        # Treat 'im Übrigen' as country-wide -> city = None
        if city:
            normalized = city.strip().lower()
            if 'im übrig' in normalized or normalized == 'im übrigen':
                city = None

        # Lookup by (country, city)
        lookup = {'country': rate_data['country'], 'city': city}

        defaults = {
            'country_code': rate_data.get('country_code', ''),
            'full_day_rate': rate_data['full_day_rate'],
            'partial_day_rate': rate_data['partial_day_rate'],
            'overnight_rate': rate_data['overnight_rate'],
            'valid_from': valid_from,
            'valid_until': None,
            'is_active': True,
        }

        rate, created = TravelPerDiemRate.objects.update_or_create(
            defaults=defaults,
            **lookup
        )

        if created:
            created_count += 1
            if city:
                print(f"✓ Created: {city}, {rate_data['country']}")
            else:
                print(f"✓ Created: {rate_data['country']} (landesweit)")
        else:
            updated_count += 1
            if city:
                print(f"↻ Updated: {city}, {rate_data['country']} - now valid from 2026-01-01")
            else:
                print(f"↻ Updated: {rate_data['country']} (landesweit) - now valid from 2026-01-01")

    print(f"\n{'='*50}")
    print(f"Done! Created: {created_count}, Updated: {updated_count}")
    print(f"Total per-diem rates in database: {TravelPerDiemRate.objects.count()}")
    print(f"Active per-diem rates: {TravelPerDiemRate.objects.filter(is_active=True).count()}")


if __name__ == '__main__':
    print("Setting up German travel per-diem rates (Verpflegungspauschalen 2026)...")
    print("="*50)
    print("WICHTIG: Bitte überprüfen Sie die Werte mit dem BMF-Schreiben vom 2.12.2024!")
    print("="*50)
    setup_per_diem_rates()
