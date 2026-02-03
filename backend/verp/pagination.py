from rest_framework.pagination import PageNumberPagination

class InfinitePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    # Increase default max page size so dropdowns can request larger result sets
    max_page_size = 2000

class CustomPageNumberPagination(PageNumberPagination):
    """
    Custom pagination that allows larger page sizes for map views and large datasets.
    Clients can request up to 10000 items per page using ?page_size=10000
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 10000

class TradingProductPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 100
