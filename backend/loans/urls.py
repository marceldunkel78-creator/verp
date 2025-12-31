from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoanViewSet, LoanItemViewSet, LoanReturnViewSet, LoanItemPhotoViewSet

router = DefaultRouter()
router.register(r'loans', LoanViewSet, basename='loan')
router.register(r'loan-items', LoanItemViewSet, basename='loan-item')
router.register(r'loan-returns', LoanReturnViewSet, basename='loan-return')
router.register(r'loan-photos', LoanItemPhotoViewSet, basename='loan-photo')

urlpatterns = [
    path('', include(router.urls)),
]
