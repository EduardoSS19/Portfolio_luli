from django.test import SimpleTestCase

from .layout_settings import (
    DEFAULT_LAYOUT_SETTINGS,
    is_valid_layout_setting,
    normalize_layout_settings,
)


class LayoutSettingsTests(SimpleTestCase):
    def test_legacy_palette_is_preserved_as_dark_and_light_is_initialized(self):
        legacy = {
            "color_background": "#211815",
            "color_surface": "#382720",
            "color_text": "#fff0e5",
            "color_muted": "#cdb8aa",
            "color_accent": "#d98d68",
        }

        normalized = normalize_layout_settings(legacy)

        self.assertEqual(normalized["dark_color_background"], "#211815")
        self.assertEqual(normalized["dark_color_surface"], "#382720")
        self.assertEqual(normalized["dark_color_text"], "#fff0e5")
        self.assertEqual(normalized["light_color_background"], DEFAULT_LAYOUT_SETTINGS["light_color_background"])
        self.assertEqual(normalized["light_color_surface"], "#ffffff")

    def test_light_and_dark_palettes_are_normalized_independently(self):
        settings = normalize_layout_settings({
            "dark_color_background": "#211815",
            "light_color_background": "#f5f2eb",
            "dark_color_text": "#fff0e5",
            "light_color_text": "#24231f",
        })

        self.assertEqual(settings["dark_color_background"], "#211815")
        self.assertEqual(settings["light_color_background"], "#f5f2eb")
        self.assertEqual(settings["dark_color_text"], "#fff0e5")
        self.assertEqual(settings["light_color_text"], "#24231f")

    def test_invalid_theme_colors_fall_back_to_theme_specific_defaults(self):
        settings = normalize_layout_settings({
            "dark_color_background": "not-a-color",
            "light_color_background": "#fff",
        })

        self.assertEqual(settings["dark_color_background"], DEFAULT_LAYOUT_SETTINGS["dark_color_background"])
        self.assertEqual(settings["light_color_background"], DEFAULT_LAYOUT_SETTINGS["light_color_background"])

    def test_theme_palette_fields_are_allow_listed(self):
        self.assertTrue(is_valid_layout_setting("dark_color_background", "#211815"))
        self.assertTrue(is_valid_layout_setting("light_color_accent", "#657c62"))
        self.assertFalse(is_valid_layout_setting("dark_color_background", "rgb(0,0,0)"))
        self.assertFalse(is_valid_layout_setting("color_background", "#061522"))


    def test_visibility_options_default_to_true_and_reject_non_booleans(self):
        settings = normalize_layout_settings({})
        self.assertTrue(settings["show_bio_image"])
        self.assertTrue(settings["show_bio"])
        self.assertTrue(settings["show_references"])
        self.assertTrue(settings["show_contact"])
        self.assertTrue(is_valid_layout_setting("show_contact", False))
        self.assertFalse(is_valid_layout_setting("show_bio", "false"))
        self.assertTrue(is_valid_layout_setting("show_bio", False))

    def test_presentation_and_navigation_modes_are_allow_listed(self):
        defaults = normalize_layout_settings({})
        self.assertEqual(defaults["presentation_mode"], "editorial")
        self.assertEqual(defaults["navigation_mode"], "curtain")
        self.assertTrue(is_valid_layout_setting("presentation_mode", "carousel"))
        self.assertTrue(is_valid_layout_setting("presentation_mode", "immersive"))
        self.assertTrue(is_valid_layout_setting("presentation_mode", "masonry"))
        self.assertTrue(is_valid_layout_setting("navigation_mode", "dropdown"))
        self.assertTrue(is_valid_layout_setting("navigation_mode", "sidebar"))
        self.assertFalse(is_valid_layout_setting("presentation_mode", "random"))
        self.assertFalse(is_valid_layout_setting("navigation_mode", "random"))

    def test_custom_artist_sections_are_normalized_and_allow_listed(self):
        sections = [{
            "id": "tattoo-flash-demo",
            "type": "tattoo-flash",
            "title": "Flash disponíveis",
            "intro": "Desenhos prontos para reservar.",
            "items": [{
                "title": "Lua crescente",
                "description": "Blackwork",
                "period": "Disponível",
                "url": "https://example.com/flash",
                "image": "https://example.com/flash.jpg",
            }],
        }]
        normalized = normalize_layout_settings({"custom_sections": sections})
        self.assertEqual(normalized["custom_sections"], sections)
        self.assertTrue(is_valid_layout_setting("custom_sections", sections))


    def test_custom_sections_preserve_type_specific_fields_and_design(self):
        sections = [{
            "id": "healed-work-demo",
            "type": "healed-work",
            "title": "Trabalhos cicatrizados",
            "intro": "Resultados após a cicatrização.",
            "design": {"layout": "before-after", "columns": "2", "image_ratio": "square", "density": "compact"},
            "items": [{
                "title": "Botânica",
                "description": "Registro após seis meses.",
                "placement": "Antebraço",
                "healing_time": "6 meses",
                "image_before": "https://example.com/before.jpg",
                "image_after": "https://example.com/after.jpg",
            }],
        }]
        normalized = normalize_layout_settings({"custom_sections": sections})
        self.assertEqual(normalized["custom_sections"], sections)
        self.assertTrue(is_valid_layout_setting("custom_sections", sections))

    def test_custom_section_normalizer_rejects_unhashable_schema_values_safely(self):
        malformed_type = [{
            "id": "bad-type", "type": [], "title": "Invalid",
            "intro": "", "items": [],
        }]
        malformed_design = [{
            "id": "bad-design", "type": "services", "title": "Services",
            "intro": "", "design": {"layout": [], "columns": {}, "image_ratio": [], "density": {}},
            "items": [{"title": "Consultoria"}],
        }]
        self.assertFalse(is_valid_layout_setting("custom_sections", malformed_type))
        self.assertFalse(is_valid_layout_setting("custom_sections", malformed_design))

    def test_custom_section_design_and_type_specific_urls_are_allow_listed(self):
        unsafe_design = [{
            "id": "unsafe-design", "type": "tattoo-flash", "title": "Flash",
            "intro": "", "design": {"layout": "script-injection", "columns": "2", "image_ratio": "square", "density": "compact"},
            "items": [{"title": "Lua"}],
        }]
        unsafe_image = [{
            "id": "unsafe-image", "type": "healed-work", "title": "Cicatrizados",
            "intro": "", "items": [{"title": "Flor", "image_after": "javascript:alert(1)"}],
        }]
        self.assertFalse(is_valid_layout_setting("custom_sections", unsafe_design))
        self.assertFalse(is_valid_layout_setting("custom_sections", unsafe_image))

    def test_custom_sections_reject_unsafe_urls_and_unknown_types(self):
        unsafe = [{
            "id": "bad-section", "type": "process", "title": "Processo",
            "intro": "", "items": [{"title": "Item", "url": "javascript:alert(1)"}],
        }]
        self.assertFalse(is_valid_layout_setting("custom_sections", unsafe))
        unknown = [{"id": "bad-type", "type": "made-up", "title": "Outro", "intro": "", "items": []}]
        self.assertFalse(is_valid_layout_setting("custom_sections", unknown))
