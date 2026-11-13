from django.test import SimpleTestCase

from .views import format_salutation_title


class CustomerCSVExportTests(SimpleTestCase):
    def test_salutation_title_are_joined_into_one_column_value(self):
        class Customer:
            salutation = 'Frau'
            title = 'Prof. Dr.'

        self.assertEqual(format_salutation_title(Customer()), 'Frau Prof. Dr.')

    def test_blank_salutation_and_title_do_not_add_extra_spaces(self):
        class Customer:
            salutation = ''
            title = 'Dr.'

        self.assertEqual(format_salutation_title(Customer()), 'Dr.')
