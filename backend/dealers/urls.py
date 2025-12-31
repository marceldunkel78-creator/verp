from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DealerViewSet, DealerDocumentViewSet, DealerEmployeeViewSet,
    DealerCustomerSystemViewSet, DealerCustomerSystemTicketViewSet,
    DealerPriceListLogViewSet, DealerQuotationLogViewSet
)

router = DefaultRouter()
router.register(r'dealers', DealerViewSet, basename='dealer')
router.register(r'dealer-documents', DealerDocumentViewSet, basename='dealer-document')
router.register(r'dealer-employees', DealerEmployeeViewSet, basename='dealer-employee')
router.register(r'dealer-customer-systems', DealerCustomerSystemViewSet, basename='dealer-customer-system')
router.register(r'dealer-customer-system-tickets', DealerCustomerSystemTicketViewSet, basename='dealer-customer-system-ticket')
router.register(r'dealer-pricelist-logs', DealerPriceListLogViewSet, basename='dealer-pricelist-log')
router.register(r'dealer-quotation-logs', DealerQuotationLogViewSet, basename='dealer-quotation-log')

urlpatterns = [
    path('', include(router.urls)),
]
