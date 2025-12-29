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
from .jwt_cookie_views import CookieTokenObtainPairView, CookieTokenRefreshView, logout_view

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication
    # Cookie-based JWT endpoints
    path('api/auth/login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', logout_view, name='token_logout'),
    
    # App URLs
    path('api/users/', include('users.urls')),
    path('api/suppliers/', include('suppliers.urls')),
    path('api/customers/', include('customers.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/customer-orders/', include('customer_orders.urls')),
    path('api/core/', include('core.urls')),
    path('api/settings/', include('verp_settings.urls')),
    path('api/company-info/', include('company.urls')),
    path('api/sales/', include('sales.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/systems/', include('systems.urls')),
    path('api/manufacturing/', include('manufacturing.urls')),
    path('api/visiview/', include('visiview.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
