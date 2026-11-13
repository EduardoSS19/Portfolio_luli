"""Safe, allow-listed visual settings for the public portfolio layout."""

DEFAULT_LAYOUT_SETTINGS = {
    "content_width": "standard",
    "hero_alignment": "center",
    "hero_size": "large",
    "section_spacing": "comfortable",
    "gallery_columns": "3",
    "default_gallery_view": "lista",
    "default_theme": "escuro"
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


def normalize_layout_settings(value):
    """Return only known settings and safe values; never accept arbitrary CSS."""
    source = value if isinstance(value, dict) else {}
    return {
        key: source.get(key) if isinstance(source.get(key), str) and source.get(key) in choices else DEFAULT_LAYOUT_SETTINGS[key]
        for key, choices in LAYOUT_SETTING_CHOICES.items()
    }
