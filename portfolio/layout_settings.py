"""Safe, allow-listed visual settings for the public portfolio."""
from .page_schema import normalize_page_schema
import re

DEFAULT_LAYOUT_SETTINGS = {
    "content_width": "standard",
    "hero_alignment": "center",
    "hero_size": "large",
    "section_spacing": "comfortable",
    "gallery_columns": "3",
    "default_gallery_view": "lista",
    "presentation_mode": "editorial",
    "heading_font": "fraunces",
    "body_font": "dm-sans",
    "navigation_font": "space-grotesk",
    "navigation_mode": "curtain",
    "default_theme": "escuro",
    "dark_color_background": "#061522",
    "dark_color_surface": "#0b2943",
    "dark_color_text": "#eff7ff",
    "dark_color_muted": "#a9bdcc",
    "dark_color_accent": "#93c8f2",
    "light_color_background": "#f5f2eb",
    "light_color_surface": "#ffffff",
    "light_color_text": "#24231f",
    "light_color_muted": "#77746c",
    "light_color_accent": "#657c62",
    "show_bio_image": True,
    "show_bio": True,
    "show_references": True,
    "show_contact": True,
    "custom_sections": [],
    "page_schema": None,
}
LAYOUT_SETTING_CHOICES = {
    "content_width": {"compact", "standard", "wide"},
    "hero_alignment": {"center", "left"},
    "hero_size": {"compact", "large"},
    "section_spacing": {"compact", "comfortable", "spacious"},
    "gallery_columns": {"2", "3", "4"},
    "default_gallery_view": {"lista", "grade"},
    "presentation_mode": {"editorial", "carousel", "immersive", "masonry", "filmstrip", "timeline", "stack", "spotlight"},
    "navigation_mode": {"curtain", "dropdown", "sidebar", "rail", "dock", "index"},
    "heading_font": {"fraunces", "playfair", "space-grotesk", "cormorant", "archivo-black"},
    "body_font": {"dm-sans", "manrope", "ibm-plex", "lora", "source-sans"},
    "navigation_font": {"dm-sans", "space-grotesk", "ibm-plex-mono", "manrope"},
    "default_theme": {"escuro", "claro"},
}
COLOR_SETTING_KEYS = {f"{theme}_{key}" for theme in ("dark", "light") for key in ("color_background", "color_surface", "color_text", "color_muted", "color_accent")}
BOOLEAN_SETTING_KEYS = {"show_bio_image", "show_bio", "show_references", "show_contact"}
CUSTOM_SECTION_TYPES = {"exhibitions", "process", "services", "press", "testimonials", "tattoo-flash", "tattoo-booking", "healed-work", "guest-spots", "studio-team"}
CUSTOM_SECTION_DESIGNS = {
    "exhibitions": {"timeline", "cards", "list"},
    "process": {"steps", "gallery", "editorial"},
    "services": {"cards", "list", "featured"},
    "press": {"list", "cards"},
    "testimonials": {"quotes", "cards"},
    "tattoo-flash": {"flash-grid", "masonry", "cards"},
    "tattoo-booking": {"steps", "accordion", "cards"},
    "healed-work": {"gallery", "before-after", "cards"},
    "guest-spots": {"agenda", "cards"},
    "studio-team": {"team-grid", "list"},
}
CUSTOM_SECTION_DEFAULT_LAYOUTS = {
    "exhibitions": "timeline", "process": "steps", "services": "cards",
    "press": "list", "testimonials": "quotes", "tattoo-flash": "flash-grid",
    "tattoo-booking": "steps", "healed-work": "gallery", "guest-spots": "agenda",
    "studio-team": "team-grid",
}
CUSTOM_SECTION_ITEM_FIELDS = {
    "exhibitions": {"venue": 200, "location": 200, "format": 120},
    "process": {"stage": 120, "technique": 160, "materials": 200},
    "services": {"format": 160, "price": 100, "duration": 100},
    "press": {"publication": 200, "author": 160},
    "testimonials": {"author": 160, "role": 120, "project": 200},
    "tattoo-flash": {"size": 80, "placement": 120, "price": 100, "status": 120},
    "tattoo-booking": {"step": 160, "channel": 120, "response_time": 100, "policy": 500},
    "healed-work": {"placement": 120, "healing_time": 100, "image_before": 500, "image_after": 500},
    "guest-spots": {"city": 120, "studio": 160, "dates": 120, "booking_url": 500},
    "studio-team": {"role": 120, "specialties": 200, "instagram": 120},
}
CUSTOM_SECTION_URL_FIELDS = {"url", "image", "image_before", "image_after", "booking_url"}
CUSTOM_SECTION_DESIGN_DEFAULTS = {"columns": "2", "image_ratio": "landscape", "density": "comfortable"}



def normalize_custom_sections(value):
    if not isinstance(value, list):
        return []
    sections = []
    for section in value[:10]:
        if not isinstance(section, dict):
            continue
        section_type = section.get("type")
        if not isinstance(section_type, str) or section_type not in CUSTOM_SECTION_TYPES:
            continue
        section_id = section.get("id")
        if not isinstance(section_id, str) or not re.fullmatch(r"[a-z0-9-]{1,48}", section_id):
            continue
        title = section.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        items = []
        allowed_fields = CUSTOM_SECTION_ITEM_FIELDS[section_type]
        for item in (section.get("items") if isinstance(section.get("items"), list) else [])[:20]:
            if not isinstance(item, dict):
                continue
            item_title = item.get("title")
            if not isinstance(item_title, str) or not item_title.strip():
                continue
            clean = {"title": item_title.strip()[:120]}
            common_fields = {"description": 1200, "url": 500, "image": 500, "period": 100}
            for key, limit in {**common_fields, **allowed_fields}.items():
                candidate = item.get(key)
                if not isinstance(candidate, str):
                    continue
                candidate = candidate.strip()
                if key in CUSTOM_SECTION_URL_FIELDS and candidate and not candidate.startswith(("https://", "http://")):
                    continue
                clean[key] = candidate[:limit]
            items.append(clean)
        normalized = {
            "id": section_id,
            "type": section_type,
            "title": title.strip()[:100],
            "intro": section.get("intro", "")[:500] if isinstance(section.get("intro", ""), str) else "",
            "items": items,
        }
        if "design" in section:
            source_design = section.get("design") if isinstance(section.get("design"), dict) else {}
            layout = source_design.get("layout")
            normalized["design"] = {
                "layout": layout if isinstance(layout, str) and layout in CUSTOM_SECTION_DESIGNS[section_type] else CUSTOM_SECTION_DEFAULT_LAYOUTS[section_type],
                "columns": source_design.get("columns") if isinstance(source_design.get("columns"), str) and source_design.get("columns") in {"1", "2", "3"} else "2",
                "image_ratio": source_design.get("image_ratio") if isinstance(source_design.get("image_ratio"), str) and source_design.get("image_ratio") in {"portrait", "square", "landscape"} else "landscape",
                "density": source_design.get("density") if isinstance(source_design.get("density"), str) and source_design.get("density") in {"compact", "comfortable", "spacious"} else "comfortable",
            }
        sections.append(normalized)
    return sections

LEGACY_COLOR_KEYS = {"color_background", "color_surface", "color_text", "color_muted", "color_accent"}
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def normalize_layout_settings(value):
    source = value if isinstance(value, dict) else {}
    normalized = {
        key: source.get(key) if isinstance(source.get(key), str) and source.get(key) in choices else DEFAULT_LAYOUT_SETTINGS[key]
        for key, choices in LAYOUT_SETTING_CHOICES.items()
    }
    for key in BOOLEAN_SETTING_KEYS:
        normalized[key] = source.get(key) if isinstance(source.get(key), bool) else DEFAULT_LAYOUT_SETTINGS[key]
    normalized["custom_sections"] = normalize_custom_sections(source.get("custom_sections", []))
    normalized["page_schema"] = normalize_page_schema(source.get("page_schema"))
    for theme in ("dark", "light"):
        for key in ("color_background", "color_surface", "color_text", "color_muted", "color_accent"):
            setting_key = f"{theme}_{key}"
            # Existing profiles stored one palette. Preserve it as the dark theme
            # and initialize the light theme with its own accessible defaults.
            candidate = source.get(setting_key)
            if candidate is None and theme == "dark":
                candidate = source.get(key)
            normalized[setting_key] = candidate.lower() if isinstance(candidate, str) and HEX_COLOR_RE.fullmatch(candidate) else DEFAULT_LAYOUT_SETTINGS[setting_key]
    return normalized


def is_valid_layout_setting(key, value):
    if key in LAYOUT_SETTING_CHOICES:
        return isinstance(value, str) and value in LAYOUT_SETTING_CHOICES[key]
    if key in COLOR_SETTING_KEYS:
        return isinstance(value, str) and bool(HEX_COLOR_RE.fullmatch(value))
    if key in BOOLEAN_SETTING_KEYS:
        return isinstance(value, bool)
    if key == "page_schema":
        return isinstance(value, dict) and normalize_page_schema(value) == value
    if key == "custom_sections":
        return isinstance(value, list) and len(value) <= 10 and normalize_custom_sections(value) == value
    return False
