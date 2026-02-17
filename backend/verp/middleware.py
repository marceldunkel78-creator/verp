class NoCacheAPIMiddleware:
    """
    Middleware that adds Cache-Control headers to API responses
    to prevent IIS/ARR/browser caching of API data.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Add no-cache headers to all API responses
        if request.path.startswith('/api/'):
            response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'

        return response
