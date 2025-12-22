from datetime import timedelta
from django.conf import settings
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def _cookie_params():
    # Cookie options - in DEBUG we keep Secure=False for local dev
    secure = not settings.DEBUG
    max_age_access = int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(hours=8)).total_seconds())
    max_age_refresh = int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7)).total_seconds())
    return {
        'access': {'httponly': True, 'secure': secure, 'samesite': 'Lax', 'path': '/', 'max_age': max_age_access},
        'refresh': {'httponly': True, 'secure': secure, 'samesite': 'Lax', 'path': '/', 'max_age': max_age_refresh},
    }


class CookieTokenObtainPairView(TokenObtainPairView):
    """Returns JWT pair and also sets them as HttpOnly cookies."""

    def post(self, request, *args, **kwargs):
        resp = super().post(request, *args, **kwargs)
        # resp is a rest_framework.response.Response
        data = getattr(resp, 'data', None) or {}
        status = getattr(resp, 'status_code', 200)

        json_resp = JsonResponse(data, status=status)

        if status == 200:
            cookies = _cookie_params()
            access = data.get('access')
            refresh = data.get('refresh')
            if access:
                params = cookies['access']
                json_resp.set_cookie('access_token', access, httponly=params['httponly'], secure=params['secure'], samesite=params['samesite'], path=params['path'], max_age=params['max_age'])
            if refresh:
                params = cookies['refresh']
                json_resp.set_cookie('refresh_token', refresh, httponly=params['httponly'], secure=params['secure'], samesite=params['samesite'], path=params['path'], max_age=params['max_age'])

        return json_resp


class CookieTokenRefreshView(TokenRefreshView):
    """Refresh view that returns new access token and sets cookie."""
    def post(self, request, *args, **kwargs):
        # If client didn't send refresh in body, try cookie
        data = {}
        try:
            # request.data may be immutable; try to copy
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        except Exception:
            data = dict(request.data) if hasattr(request, 'data') else {}

        if 'refresh' not in data and 'refresh_token' in request.COOKIES:
            data['refresh'] = request.COOKIES.get('refresh_token')

        # Use serializer from parent class to validate
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        response_data = {'access': validated_data.get('access')}
        if 'refresh' in validated_data:
            response_data['refresh'] = validated_data.get('refresh')

        status = 200
        json_resp = JsonResponse(response_data, status=status)

        # Set cookies if tokens present
        cookies = _cookie_params()
        access = response_data.get('access')
        refresh = response_data.get('refresh')
        if access:
            params = cookies['access']
            json_resp.set_cookie('access_token', access, httponly=params['httponly'], secure=params['secure'], samesite=params['samesite'], path=params['path'], max_age=params['max_age'])
        if refresh:
            params = cookies['refresh']
            json_resp.set_cookie('refresh_token', refresh, httponly=params['httponly'], secure=params['secure'], samesite=params['samesite'], path=params['path'], max_age=params['max_age'])

        return json_resp


def logout_view(request):
    """Clears JWT cookies."""
    resp = JsonResponse({'detail': 'Logged out'}, status=200)
    resp.delete_cookie('access_token', path='/')
    resp.delete_cookie('refresh_token', path='/')
    return resp
