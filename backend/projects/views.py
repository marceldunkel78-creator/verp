from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Project
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectCreateSerializer
)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet für Projekte mit automatischer Projektnummer
    """
    queryset = Project.objects.select_related('customer', 'created_by').prefetch_related('systems')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer']
    search_fields = ['project_number', 'name', 'description', 'customer__first_name', 'customer__last_name']
    ordering_fields = ['created_at', 'updated_at', 'project_number', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        elif self.action == 'create':
            return ProjectCreateSerializer
        return ProjectDetailSerializer

    def perform_create(self, serializer):
        """Setze created_by beim Erstellen"""
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Projekt-Statistiken"""
        queryset = self.filter_queryset(self.get_queryset())
        
        total = queryset.count()
        by_status = {}
        for choice in Project.STATUS_CHOICES:
            count = queryset.filter(status=choice[0]).count()
            by_status[choice[0]] = {
                'label': choice[1],
                'count': count
            }

        return Response({
            'total': total,
            'by_status': by_status
        })
