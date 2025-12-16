from django.urls import path
from .views import dashboard_stats, module_list

urlpatterns = [
    path('dashboard/', dashboard_stats, name='dashboard-stats'),
    path('modules/', module_list, name='module-list'),
]
