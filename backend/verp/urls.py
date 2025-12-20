"""
URL configuration for VERP project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # App URLs
    path('api/users/', include('users.urls')),
    path('api/suppliers/', include('suppliers.urls')),
    path('api/customers/', include('customers.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/core/', include('core.urls')),
    path('api/settings/', include('verp_settings.urls')),
    path('api/company-info/', include('company.urls')),
    path('api/sales/', include('sales.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
