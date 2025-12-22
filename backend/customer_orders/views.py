from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import CustomerOrder, CustomerOrderItem
from .serializers import (
    CustomerOrderListSerializer, CustomerOrderDetailSerializer, CustomerOrderCreateUpdateSerializer, CustomerOrderItemSerializer
)
from rest_framework.pagination import PageNumberPagination


class CustomerOrderPagination(PageNumberPagination):
    page_size = 20


class CustomerOrderViewSet(viewsets.ModelViewSet):
    queryset = CustomerOrder.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer']
    search_fields = ['order_number', 'project_reference', 'system_reference']
    ordering_fields = ['order_number', 'order_date', 'created_at']
    pagination_class = CustomerOrderPagination

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerOrderListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return CustomerOrderCreateUpdateSerializer
        return CustomerOrderDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CustomerOrderItemViewSet(viewsets.ModelViewSet):
    queryset = CustomerOrderItem.objects.all()
    serializer_class = CustomerOrderItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order']
