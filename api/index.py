# -*- coding: utf-8 -*-
"""
iTunes Albums + YouTube Player — Super Deus Supremo

Backend:
- iTunes Search API: artistas, álbuns e faixas
- YouTube Data API v3: pesquisa do melhor vídeo embutível
- Letras opcionais: LRCLIB sem API key, quando disponível
- Preparado para Vercel: app Flask exportada em api/index.py
"""

import os
import re
import time
from functools import lru_cache

import requests
from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()
ITUNES_COUNTRY = os.getenv("ITUNES_COUNTRY", "PT").strip().upper() or "PT"

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup"
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
LRCLIB_SEARCH_URL = "https://lrclib.net/api/search"

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "12"))

BAD_VIDEO_WORDS = (
    "karaoke",
    "cover",
    "covers",
    "instrumental",
    "reaction",
    "reactions",
    "remix",
    "sped up",
    "slowed",
    "nightcore",
    "tradução",
    "traducao",
    "legendado",
    "lyrics",
    "letra",
    "letras",
    "live",
    "ao vivo",
    "aula",
    "tutorial",
    "chipmunk",
    "8d audio",
)

GOOD_VIDEO_WORDS = (
    "official",
    "official audio",
    "official video",
    "music video",
    "video oficial",
    "audio",
    "visualizer",
)

_memory_cache = {}
CACHE_SECONDS = 60 * 20


def now_ts():
    return int(time.time())


def cached_key(url, params):
    items = tuple(sorted((str(k), str(v)) for k, v in params.items()))
    return url, items


def cached_api_get(url, params, timeout=REQUEST_TIMEOUT):
    key = cached_key(url, params)
    cached = _memory_cache.get(key)
    if cached and now_ts() - cached["ts"] < CACHE_SECONDS:
        return cached["data"], None

    try:
        headers = {"User-Agent": "Mozilla/5.0 SuperDeusSupremo/1.0"}
        r = requests.get(url, params=params, headers=headers, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        _memory_cache[key] = {"ts": now_ts(), "data": data}
        return data, None
    except requests.exceptions.Timeout:
        return None, "Tempo esgotado ao contactar a API."
    except requests.exceptions.HTTPError as exc:
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", "HTTP")
        text = getattr(response, "text", "")[:320]
        return None, f"Erro HTTP da API: {status}. {text}"
    except Exception as exc:
        return None, f"Erro ao contactar a API: {type(exc).__name__}: {exc}"


def clean_text(value):
    value = str(value or "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize(value):
    value = clean_text(value).lower()
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"\[[^]]*\]", " ", value)
    value = re.sub(r"[^a-z0-9À-ÿ]+", " ", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip()


def artwork_600(url):
    url = clean_text(url)
    if not url:
        return ""
    return (
        url.replace("100x100bb", "600x600bb")
        .replace("60x60bb", "600x600bb")
        .replace("30x30bb", "600x600bb")
        .replace("170x170bb", "600x600bb")
    )


def ms_to_time(ms):
    try:
        seconds = int(ms or 0) // 1000
    except Exception:
        seconds = 0
    minutes = seconds // 60
    seconds = seconds % 60
    return f"{minutes}:{seconds:02d}"


def safe_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def first_year(date_value):
    date_value = clean_text(date_value)
    if len(date_value) >= 4 and date_value[:4].isdigit():
        return date_value[:4]
    return ""


def pack_artist(item):
    return {
        "artistId": item.get("artistId"),
        "artistName": clean_text(item.get("artistName")),
        "artistLinkUrl": item.get("artistLinkUrl", ""),
        "primaryGenreName": item.get("primaryGenreName", "Music"),
    }


def pack_album(item):
    return {
        "collectionId": item.get("collectionId"),
        "collectionName": clean_text(item.get("collectionName")),
        "artistId": item.get("artistId"),
        "artistName": clean_text(item.get("artistName")),
        "artworkUrl100": artwork_600(item.get("artworkUrl100")),
        "releaseDate": (item.get("releaseDate") or "")[:10],
        "releaseYear": first_year(item.get("releaseDate")),
        "trackCount": item.get("trackCount", 0),
        "primaryGenreName": item.get("primaryGenreName", "Music"),
        "collectionViewUrl": item.get("collectionViewUrl", ""),
        "copyright": item.get("copyright", ""),
        "collectionType": item.get("collectionType", "Album"),
    }


def pack_track(item, fallback_album=None):
    fallback_album = fallback_album or {}
    return {
        "trackId": item.get("trackId"),
        "trackName": clean_text(item.get("trackName")),
        "artistName": clean_text(item.get("artistName") or fallback_album.get("artistName")),
        "collectionId": item.get("collectionId") or fallback_album.get("collectionId"),
        "collectionName": clean_text(item.get("collectionName") or fallback_album.get("collectionName")),
        "trackNumber": item.get("trackNumber", 0),
        "discNumber": item.get("discNumber", 1),
        "trackTimeMillis": item.get("trackTimeMillis", 0),
        "duration": ms_to_time(item.get("trackTimeMillis")),
        "artworkUrl100": artwork_600(item.get("artworkUrl100") or fallback_album.get("artworkUrl100")),
        "previewUrl": item.get("previewUrl", ""),
        "trackViewUrl": item.get("trackViewUrl", ""),
        "primaryGenreName": item.get("primaryGenreName", fallback_album.get("primaryGenreName", "Music")),
    }


def token_hits(text, wanted, points):
    score = 0
    for token in [t for t in re.split(r"\W+", normalize(wanted)) if len(t) >= 3]:
        if token in text:
            score += points
    return score


def score_youtube_item(item, wanted_artist, wanted_track, wanted_album=""):
    snippet = item.get("snippet", {}) or {}
    title = normalize(snippet.get("title", ""))
    channel = normalize(snippet.get("channelTitle", ""))
    description = normalize(snippet.get("description", ""))
    haystack = f"{title} {channel} {description}"

    score = 0
    score += token_hits(haystack, wanted_artist, 4)
    score += token_hits(haystack, wanted_track, 5)
    score += token_hits(haystack, wanted_album, 1)

    title_norm = normalize(wanted_track)
    artist_norm = normalize(wanted_artist)

    if title_norm and title_norm in title:
        score += 16
    if artist_norm and artist_norm in haystack:
        score += 8

    for good in GOOD_VIDEO_WORDS:
        if normalize(good) in haystack:
            score += 7

    if "vevo" in channel:
        score += 8
    if "topic" in channel:
        score += 9
    if "official" in channel:
        score += 4

    for bad in BAD_VIDEO_WORDS:
        if normalize(bad) in haystack:
            score -= 10

    # Penaliza títulos demasiado diferentes.
    if title_norm and title_norm not in title and score < 18:
        score -= 4

    return score


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "app": "iTunes + YouTube Super Deus Supremo",
            "youtube_api_key_ready": bool(YOUTUBE_API_KEY),
            "itunes_country": ITUNES_COUNTRY,
            "features": [
                "artists",
                "albums",
                "tracks",
                "youtube_player",
                "queue",
                "playlists_localstorage",
                "favorites_localstorage",
                "history_localstorage",
                "lyrics_optional",
            ],
        }
    )


@app.route("/api/search-artists")
def search_artists():
    q = clean_text(request.args.get("q", ""))
    if not q:
        return jsonify({"ok": False, "error": "Escreve o nome de um artista.", "artists": []}), 400

    data, error = cached_api_get(
        ITUNES_SEARCH_URL,
        {
            "term": q,
            "media": "music",
            "entity": "musicArtist",
            "attribute": "artistTerm",
            "country": ITUNES_COUNTRY,
            "limit": 18,
        },
    )
    if error:
        return jsonify({"ok": False, "error": error, "artists": []}), 502

    artists = []
    seen = set()
    for item in data.get("results", []):
        artist_id = item.get("artistId")
        name = clean_text(item.get("artistName"))
        if not artist_id or not name or artist_id in seen:
            continue
        seen.add(artist_id)
        artists.append(pack_artist(item))

    return jsonify({"ok": True, "query": q, "artists": artists})


@app.route("/api/artist/<int:artist_id>/albums")
def artist_albums(artist_id):
    include_duplicates = request.args.get("duplicates", "0") == "1"

    data, error = cached_api_get(
        ITUNES_LOOKUP_URL,
        {
            "id": artist_id,
            "entity": "album",
            "country": ITUNES_COUNTRY,
            "limit": 260,
        },
    )
    if error:
        return jsonify({"ok": False, "error": error, "artist": None, "albums": []}), 502

    artist = None
    albums = []
    seen = set()

    for item in data.get("results", []):
        wrapper = item.get("wrapperType")

        if wrapper == "artist":
            artist = pack_artist(item)
            continue

        if wrapper != "collection":
            continue

        collection_id = item.get("collectionId")
        name = clean_text(item.get("collectionName"))
        if not collection_id or not name:
            continue

        key = (normalize(name), item.get("artistId"))
        if not include_duplicates and key in seen:
            continue
        seen.add(key)
        albums.append(pack_album(item))

    albums.sort(key=lambda a: (a.get("releaseDate") or "", safe_int(a.get("trackCount"))), reverse=True)

    return jsonify({"ok": True, "artist": artist, "albums": albums})


@app.route("/api/album/<int:collection_id>/tracks")
def album_tracks(collection_id):
    data, error = cached_api_get(
        ITUNES_LOOKUP_URL,
        {
            "id": collection_id,
            "entity": "song",
            "country": ITUNES_COUNTRY,
            "limit": 260,
        },
    )
    if error:
        return jsonify({"ok": False, "error": error, "album": None, "tracks": []}), 502

    album = None
    tracks = []

    for item in data.get("results", []):
        wrapper = item.get("wrapperType")

        if wrapper == "collection":
            album = pack_album(item)
            continue

        if wrapper != "track":
            continue

        if item.get("kind") and item.get("kind") != "song":
            continue

        track_name = clean_text(item.get("trackName"))
        if not track_name:
            continue

        tracks.append(pack_track(item, album))

    tracks.sort(key=lambda t: (safe_int(t.get("discNumber"), 1), safe_int(t.get("trackNumber"))))

    return jsonify({"ok": True, "album": album, "tracks": tracks})


@app.route("/api/youtube/search")
def youtube_search():
    if not YOUTUBE_API_KEY:
        return jsonify(
            {
                "ok": False,
                "error": "Falta configurar a variável de ambiente YOUTUBE_API_KEY.",
                "videos": [],
            }
        ), 500

    artist = clean_text(request.args.get("artist", ""))
    track = clean_text(request.args.get("track", ""))
    album = clean_text(request.args.get("album", ""))

    if not artist or not track:
        return jsonify({"ok": False, "error": "Falta artista ou música.", "videos": []}), 400

    queries = [
        f'{artist} "{track}" official audio',
        f'{artist} "{track}" official video',
        f'{artist} "{track}" topic',
        f'{artist} {track} {album}'.strip(),
    ]

    collected = []
    seen_ids = set()
    last_error = None

    for q in queries:
        data, error = cached_api_get(
            YOUTUBE_SEARCH_URL,
            {
                "key": YOUTUBE_API_KEY,
                "part": "snippet",
                "q": q,
                "type": "video",
                "videoEmbeddable": "true",
                "videoSyndicated": "true",
                "videoCategoryId": "10",
                "maxResults": 10,
                "safeSearch": "none",
                "order": "relevance",
            },
            timeout=10,
        )

        if error:
            last_error = error
            continue

        for item in data.get("items", []):
            video_id = ((item.get("id") or {}).get("videoId") or "").strip()
            if not video_id or video_id in seen_ids:
                continue
            seen_ids.add(video_id)

            snippet = item.get("snippet", {}) or {}
            collected.append(
                {
                    "videoId": video_id,
                    "title": clean_text(snippet.get("title", "")),
                    "channelTitle": clean_text(snippet.get("channelTitle", "")),
                    "description": clean_text(snippet.get("description", ""))[:220],
                    "publishedAt": snippet.get("publishedAt", ""),
                    "thumbnail": ((snippet.get("thumbnails") or {}).get("high") or {}).get("url")
                    or ((snippet.get("thumbnails") or {}).get("medium") or {}).get("url")
                    or "",
                    "score": score_youtube_item(item, artist, track, album),
                    "query": q,
                }
            )

        if len(collected) >= 8:
            break

    collected.sort(key=lambda v: v.get("score", 0), reverse=True)

    if not collected:
        return jsonify(
            {
                "ok": False,
                "error": last_error or "Não encontrei vídeo embutível no YouTube para esta música.",
                "videos": [],
            }
        ), 404

    return jsonify({"ok": True, "artist": artist, "track": track, "album": album, "videos": collected[:8]})


@app.route("/api/lyrics")
def lyrics():
    artist = clean_text(request.args.get("artist", ""))
    track = clean_text(request.args.get("track", ""))

    if not artist or not track:
        return jsonify({"ok": False, "error": "Falta artista ou música.", "lyrics": ""}), 400

    # LRCLIB é opcional. Se falhar, o player continua normal.
    data, error = cached_api_get(
        LRCLIB_SEARCH_URL,
        {"artist_name": artist, "track_name": track},
        timeout=6,
    )

    if error:
        return jsonify({"ok": False, "error": error, "lyrics": ""}), 502

    best = None
    target_artist = normalize(artist)
    target_track = normalize(track)

    for item in data if isinstance(data, list) else []:
        item_artist = normalize(item.get("artistName"))
        item_track = normalize(item.get("trackName"))
        if target_track and target_track in item_track:
            best = item
            if target_artist and target_artist in item_artist:
                break

    if not best:
        return jsonify({"ok": False, "error": "Letra não encontrada.", "lyrics": ""}), 404

    plain = clean_text(best.get("plainLyrics", ""))
    synced = best.get("syncedLyrics", "")

    return jsonify(
        {
            "ok": True,
            "artist": best.get("artistName", artist),
            "track": best.get("trackName", track),
            "album": best.get("albumName", ""),
            "lyrics": plain,
            "syncedLyrics": synced,
            "instrumental": bool(best.get("instrumental")),
        }
    )


@app.errorhandler(404)
def not_found(_):
    return render_template("index.html"), 404


if __name__ == "__main__":
    app.run(debug=True)
