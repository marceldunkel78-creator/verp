from django.urls import path
from . import views

app_name = 'bi'

urlpatterns = [
    # Tab 1: Sales Statistics
    path('statistics/sales/', views.SalesStatisticsView.as_view(), name='sales-statistics'),
    path('statistics/sales/by-product/', views.SalesByProductView.as_view(), name='sales-by-product'),
    path('statistics/sales/by-category/', views.SalesByCategoryView.as_view(), name='sales-by-category'),
    path('statistics/sales/by-customer/', views.SalesByCustomerView.as_view(), name='sales-by-customer'),
    path('statistics/sales/by-supplier/', views.SalesBySupplierView.as_view(), name='sales-by-supplier'),
    path('statistics/sales/by-inventory-category/', views.SalesByInventoryCategoryView.as_view(), name='sales-by-inventory-category'),
    
    # Tab 2: Forecast
    path('forecast/projects/', views.ProjectForecastView.as_view(), name='project-forecast'),
    path('forecast/quotations/', views.QuotationForecastView.as_view(), name='quotation-forecast'),
    path('forecast/combined/', views.CombinedForecastView.as_view(), name='combined-forecast'),
    
    # Tab 3: Expected Payments
    path('payments/expected/', views.ExpectedPaymentsView.as_view(), name='expected-payments'),
    
    # Utility endpoints for filters
    path('filters/categories/', views.CategoryListView.as_view(), name='filter-categories'),
    path('filters/products/', views.ProductListView.as_view(), name='filter-products'),
    path('filters/suppliers/', views.SupplierListView.as_view(), name='filter-suppliers'),
    path('filters/product-categories/', views.ProductCategoryListView.as_view(), name='filter-product-categories'),
]
