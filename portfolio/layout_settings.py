"""Safe, allow-listed visual settings for the public portfolio."""
import re

DEFAULT_LAYOUT_SETTINGS = {
    "content_width": "standard",
    "hero_alignment": "center",
    "hero_size": "large",
    "section_spacing": "comfortable",
    "gallery_columns": "3",
    "default_gallery_view": "lista",
    "default_theme": "escuro",
    "color_background": "#061522",
    "color_surface": "#0b2943",
    "color_text": "#eff7ff",
    "color_muted": "#a9bdcc",
    "color_accent": "#93c8f2",
}
LAYOUT_SETTING_CHOICES = {
    "content_width": {"compact", "standard", "wide"},
    "hero_alignment": {"center", "left"},
    "hero_size": {"compact", "large"},
    "section_spacing": {"compact", "comfortable", "spacious"},
    "gallery_columns": {"2", "3", "4"},
    "default_gallery_view": {"lista", "grade"},
    "default_theme": {"escuro", "claro"},
}
COLOR_SETTING_KEYS = {"color_background", "color_surface", "color_text", "color_muted", "color_accent"}
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def normalize_layout_settings(value):
    source = value if isinstance(value, dict) else {}
    normalized = {
        key: source.get(key) if isinstance(source.get(key), str) and source.get(key) in choices else DEFAULT_LAYOUT_SETTINGS[key]
        for key, choices in LAYOUT_SETTING_CHOICES.items()
    }
    for key in COLOR_SETTING_KEYS:
        candidate = source.get(key)
        normalized[key] = candidate.lower() if isinstance(candidate, str) and HEX_COLOR_RE.fullmatch(candidate) else DEFAULT_LAYOUT_SETTINGS[key]
    return normalized


def is_valid_layout_setting(key, value):
    if key in LAYOUT_SETTING_CHOICES:
        return isinstance(value, str) and value in LAYOUT_SETTING_CHOICES[key]
    if key in COLOR_SETTING_KEYS:
        return isinstance(value, str) and bool(HEX_COLOR_RE.fullmatch(value))
    return False
