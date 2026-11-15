from django.test import SimpleTestCase
from django.urls import resolve

from .views import frontend


class ComposablePortfolioRouteTests(SimpleTestCase):
    def test_artist_created_page_slugs_resolve_to_react_frontend(self):
        for path in ("/sobre", "/projetos", "/flash-disponiveis"):
            self.assertIs(resolve(path).func, frontend)

    def test_reserved_routes_are_not_captured_by_portfolio_page_route(self):
        self.assertEqual(resolve("/api/health/").url_name, "healthcheck")
        self.assertEqual(resolve("/painel/").url_name, "cms-frontend-slash")
