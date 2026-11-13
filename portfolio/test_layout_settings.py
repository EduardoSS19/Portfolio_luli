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
        self.assertFalse(is_valid_layout_setting("show_bio", "false"))
        self.assertTrue(is_valid_layout_setting("show_bio", False))
