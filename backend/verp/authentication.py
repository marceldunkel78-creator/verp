from rest_framework_simplejwt.authentication import JWTAuthentication


class JWTCookieAuthentication(JWTAuthentication):
    """JWT authentication that also reads token from HttpOnly cookie `access_token`.

    Falls Authorization header fehlt, wird die `access_token`-Cookie verwendet.
    """

    def authenticate(self, request):
        # First try standard header authentication
        result = super().authenticate(request)
        if result is not None:
            return result

        # Try cookie
        raw_token = request.COOKIES.get('access_token')
        if not raw_token:
            return None

        # Use parent methods to validate token and get user
        validated_token = None
        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            return None

        return self.get_user(validated_token), validated_token
