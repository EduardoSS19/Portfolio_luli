import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

from django.conf import settings


YOUTUBE_VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"


class YouTubeMetadataError(Exception):
    pass


def extract_youtube_video_id(video_url):
    try:
        parsed_url = urlsplit(video_url.strip())
    except ValueError as error:
        raise YouTubeMetadataError("Informe um link válido de vídeo do YouTube.") from error

    if parsed_url.scheme not in {"http", "https"}:
        raise YouTubeMetadataError("Informe um link válido de vídeo do YouTube.")
    hostname = (parsed_url.hostname or "").lower()

    if hostname in {"youtu.be", "www.youtu.be"}:
        video_id = parsed_url.path.strip("/").split("/")[0]
    elif hostname in {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
    }:
        if parsed_url.path == "/watch":
            video_id = parse_qs(parsed_url.query).get("v", [""])[0]
        else:
            path_parts = parsed_url.path.strip("/").split("/")
            video_id = path_parts[1] if len(path_parts) > 1 and path_parts[0] in {
                "embed",
                "shorts",
                "live",
            } else ""
    else:
        video_id = ""

    if not YOUTUBE_VIDEO_ID_PATTERN.fullmatch(video_id):
        raise YouTubeMetadataError("Informe um link válido de vídeo do YouTube.")
    return video_id


def fetch_youtube_video_metadata(video_url):
    video_id = extract_youtube_video_id(video_url)
    api_key = settings.YOUTUBE_API_KEY.strip()
    if not api_key:
        raise YouTubeMetadataError(
            "Configure a variável YOUTUBE_API_KEY no servidor antes de adicionar vídeos."
        )

    query = urlencode({"part": "snippet,status", "id": video_id, "key": api_key})
    request = Request(f"{YOUTUBE_API_URL}?{query}")
    try:
        with urlopen(request, timeout=8) as response:
            data = json.loads(response.read())
    except HTTPError as error:
        if error.code == 403:
            raise YouTubeMetadataError(
                "A YouTube Data API rejeitou a consulta. Verifique a chave, a API habilitada e a cota."
            ) from error
        raise YouTubeMetadataError("Não foi possível consultar os dados do vídeo no YouTube.") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise YouTubeMetadataError(
            "Não foi possível consultar os dados do vídeo no YouTube."
        ) from error

    items = data.get("items", [])
    if not items:
        raise YouTubeMetadataError(
            "Vídeo não encontrado ou inacessível pela API. Confira se o link está correto."
        )

    item = items[0]
    if not item.get("status", {}).get("embeddable", False):
        raise YouTubeMetadataError("Este vídeo não permite incorporação em outros sites.")

    snippet = item.get("snippet", {})
    thumbnails = snippet.get("thumbnails", {})
    thumbnail = next(
        (
            thumbnails[size]["url"]
            for size in ("maxres", "standard", "high", "medium", "default")
            if size in thumbnails
        ),
        "",
    )
    if not thumbnail:
        raise YouTubeMetadataError("O YouTube não forneceu uma miniatura para este vídeo.")

    return {
        "video_id": video_id,
        "title": snippet.get("title", ""),
        "thumbnail_url": thumbnail,
    }
