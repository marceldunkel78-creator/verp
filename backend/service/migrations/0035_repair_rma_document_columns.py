from django.db import migrations


RMA_DOCUMENT_SCHEMA_REPAIR_SQL = """
-- Repair columns that were previously recorded in Django's migration state
-- without always being created in older production databases.
ALTER TABLE public.service_rmareturn
    ADD COLUMN IF NOT EXISTS proforma_address_city varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_address_country varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_address_house_number varchar(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_address_name varchar(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_address_postal_code varchar(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_address_street varchar(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_comment text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_pdf varchar(100),
    ADD COLUMN IF NOT EXISTS proforma_title varchar(200) NOT NULL DEFAULT 'Proforma Invoice – For Customs Purposes Only / No Commercial Value',
    ADD COLUMN IF NOT EXISTS proforma_subtitle varchar(300) NOT NULL DEFAULT 'For Customs Purposes Only / No Commercial Value';

ALTER TABLE public.service_rmareturnitem
    ADD COLUMN IF NOT EXISTS custom_article_number varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_product_name varchar(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_serial_number varchar(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_unit varchar(50) NOT NULL DEFAULT 'Stk',
    ADD COLUMN IF NOT EXISTS proforma_description varchar(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_hs_code varchar(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_origin_country varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_value numeric(12, 2),
    ADD COLUMN IF NOT EXISTS proforma_weight numeric(10, 3);

ALTER TABLE public.service_rmamanufacturerreturnitem
    ADD COLUMN IF NOT EXISTS proforma_description varchar(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_hs_code varchar(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_origin_country varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS proforma_value numeric(12, 2),
    ADD COLUMN IF NOT EXISTS proforma_weight numeric(10, 3),
    ADD COLUMN IF NOT EXISTS custom_article_number varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_product_name varchar(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_serial_number varchar(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_unit varchar(50) NOT NULL DEFAULT 'Stk';

ALTER TABLE public.service_rmareturnitem
    ALTER COLUMN rma_item_id DROP NOT NULL;

ALTER TABLE public.service_rmamanufacturerreturnitem
    ALTER COLUMN rma_item_id DROP NOT NULL;

ALTER TABLE public.service_rmacase
    ADD COLUMN IF NOT EXISTS manufacturer_address_city varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS manufacturer_address_country varchar(100) NOT NULL DEFAULT 'Deutschland',
    ADD COLUMN IF NOT EXISTS manufacturer_address_house_number varchar(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS manufacturer_address_name varchar(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS manufacturer_address_postal_code varchar(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS manufacturer_address_street varchar(200) NOT NULL DEFAULT '';
"""


class Migration(migrations.Migration):
    dependencies = [
        ('service', '0034_alter_rmacase_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql=RMA_DOCUMENT_SCHEMA_REPAIR_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
