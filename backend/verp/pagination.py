from rest_framework.pagination import PageNumberPagination

class InfinitePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    # Increase default max page size so dropdowns can request larger result sets
    max_page_size = 2000

class TradingProductPagination(PageNumberPagination):
    page_size = 9
    page_size_query_param = 'page_size'
    max_page_size = 100
