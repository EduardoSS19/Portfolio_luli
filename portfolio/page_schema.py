"""Composable, allow-listed page composition schema."""
import re

PAGE_SECTION_TYPES = {"hero", "about", "gallery", "featured-work", "rich-text", "image", "references", "contact", "tattoo-flash", "custom"}
PAGE_SETTING_LIMITS = {"title":180,"eyebrow":100,"body":5000,"align":20,"width":20,"layout":30,"category_key":50,"work_title":150,"show_description":None,"show_image":None,"show_bio":None,"cta_label":80,"cta_url":500,"image_url":500,"alt":180,"caption":300,"ratio":20,"custom_section_id":48}
PAGE_ALIGNMENTS = {"left","center","right"}
PAGE_WIDTHS = {"narrow","standard","wide"}
PAGE_RATIOS = {"landscape","portrait","square"}


def normalize_page_schema(value):
    if not isinstance(value, dict) or value.get("version") != 1:
        return None
    pages = []
    seen_page_ids, seen_slugs = set(), set()
    source_pages = value.get("pages") if isinstance(value.get("pages"), list) else []
    for page in source_pages[:12]:
        if not isinstance(page, dict):
            continue
        page_id, slug, title = page.get("id"), page.get("slug"), page.get("title")
        if not isinstance(page_id, str) or not re.fullmatch(r"[a-z0-9-]{1,48}", page_id):
            continue
        if not isinstance(slug, str) or not re.fullmatch(r"[a-z0-9-]{1,48}", slug):
            continue
        if not isinstance(title, str) or not title.strip() or page_id in seen_page_ids or slug in seen_slugs:
            continue
        seen_page_ids.add(page_id)
        seen_slugs.add(slug)
        sections = []
        seen_section_ids = set()
        source_sections = page.get("sections") if isinstance(page.get("sections"), list) else []
        for section in source_sections[:40]:
            if not isinstance(section, dict):
                continue
            section_id, section_type = section.get("id"), section.get("type")
            if not isinstance(section_id, str) or not re.fullmatch(r"[a-z0-9-]{1,48}", section_id):
                continue
            if not isinstance(section_type, str) or section_type not in PAGE_SECTION_TYPES or section_id in seen_section_ids:
                continue
            seen_section_ids.add(section_id)
            source_settings = section.get("settings") if isinstance(section.get("settings"), dict) else {}
            settings = {}
            for key, limit in PAGE_SETTING_LIMITS.items():
                candidate = source_settings.get(key)
                if limit is None:
                    if isinstance(candidate, bool):
                        settings[key] = candidate
                    continue
                if not isinstance(candidate, str):
                    continue
                candidate = candidate.strip()
                if key == "align" and candidate not in PAGE_ALIGNMENTS:
                    continue
                if key == "width" and candidate not in PAGE_WIDTHS:
                    continue
                if key == "ratio" and candidate not in PAGE_RATIOS:
                    continue
                if key in {"cta_url", "image_url"} and candidate and not candidate.startswith(("https://", "http://", "/", "#")):
                    continue
                settings[key] = candidate[:limit]
            sections.append({"id":section_id,"type":section_type,"settings":settings})
        pages.append({"id":page_id,"slug":slug,"title":title.strip()[:100],"published":page.get("published") is not False,"sections":sections})
    return {"version":1,"pages":pages} if pages else None
