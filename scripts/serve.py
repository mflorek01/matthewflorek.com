#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import time
from functools import partial
from html.parser import HTMLParser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parent.parent
CONTENT_FILE = ROOT_DIR / "content" / "site-copy.json"
ALLOWED_KEYS = set(json.loads(CONTENT_FILE.read_text(encoding="utf-8")).keys())
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
PLAIN_TEXT_KEYS = {
    "metaTitle",
    "metaDescription",
    "wordmark",
    "navFocus",
    "navResume",
    "navContact",
    "heroPrimaryCta",
    "heroSecondaryCta",
    "heroTertiaryCta",
    "detailEmailLabel",
    "detailPhoneLabel",
    "detailFocusLabel",
    "portraitImagePath",
    "portraitAlt",
    "portraitKicker",
    "focusEyebrow",
    "resumeEyebrow",
    "resumePrimaryCta",
    "resumeSecondaryCta",
    "resumeFallbackCta",
    "contactEyebrow",
    "emailAddress",
    "phoneDisplay",
    "phoneHref",
    "linkedinUrl",
    "linkedinDisplay",
}


class RichTextSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        normalized = self._normalize_tag(tag)
        if normalized == "br":
            self.parts.append("<br>")
        elif normalized in {"strong", "em"}:
            self.parts.append(f"<{normalized}>")
        elif tag in {"div", "p", "section", "article", "header", "footer", "li"}:
            pass

    def handle_endtag(self, tag: str) -> None:
        normalized = self._normalize_tag(tag)
        if normalized in {"strong", "em"}:
            self.parts.append(f"</{normalized}>")
        elif tag in {"div", "p", "section", "article", "header", "footer", "li"}:
            self.parts.append("<br>")

    def handle_data(self, data: str) -> None:
        self.parts.append(
            data.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    def _normalize_tag(self, tag: str) -> str:
        if tag in {"b", "strong"}:
            return "strong"
        if tag in {"i", "em"}:
            return "em"
        return tag

    def get_output(self) -> str:
        sanitized = "".join(self.parts)
        sanitized = sanitized.replace("<strong></strong>", "").replace("<em></em>", "")
        while "<br><br><br>" in sanitized:
            sanitized = sanitized.replace("<br><br><br>", "<br><br>")

        for prefix in ("<br>", "\n", " "):
            while sanitized.startswith(prefix):
                sanitized = sanitized[len(prefix):]

        for suffix in ("<br>", "\n", " "):
            while sanitized.endswith(suffix):
                sanitized = sanitized[: -len(suffix)]

        return sanitized


def sanitize_rich_text(value: str) -> str:
    sanitizer = RichTextSanitizer()
    sanitizer.feed(value)
    sanitizer.close()
    return sanitizer.get_output()


def sanitize_payload(payload: dict) -> dict:
    sanitized: dict[str, object] = {}
    for key, value in payload.items():
        if key not in ALLOWED_KEYS:
            continue

        if isinstance(value, str):
            if key in PLAIN_TEXT_KEYS:
                sanitized[key] = value.strip()
            else:
                sanitized[key] = sanitize_rich_text(value)
        elif key == "toolChips" and isinstance(value, list):
            sanitized[key] = [str(item).strip() for item in value if str(item).strip()]

    missing_keys = ALLOWED_KEYS - set(sanitized.keys())
    if missing_keys:
        current = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
        for key in missing_keys:
            sanitized[key] = current[key]

    return sanitized


def read_content() -> dict:
    return json.loads(CONTENT_FILE.read_text(encoding="utf-8"))


def write_content(content: dict) -> None:
    CONTENT_FILE.write_text(
        json.dumps(content, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


def save_profile_image(payload: dict) -> dict:
    filename = str(payload.get("filename", "")).strip()
    data_url = str(payload.get("data", "")).strip()
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValueError("Only PNG, JPG, JPEG, and WebP images are supported.")

    if not data_url.startswith("data:") or ";base64," not in data_url:
        raise ValueError("Invalid image payload.")

    _, encoded = data_url.split(",", 1)

    try:
        binary = base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise ValueError("Image data could not be decoded.") from exc

    if len(binary) > MAX_IMAGE_BYTES:
        raise ValueError("Image file is too large. Keep it under 8 MB.")

    output_name = f"profile-photo{extension}"
    output_path = ROOT_DIR / "assets" / output_name
    output_path.write_bytes(binary)

    content = read_content()
    content["portraitImagePath"] = f"assets/{output_name}?v={int(time.time())}"
    write_content(content)
    return content


class SiteRequestHandler(SimpleHTTPRequestHandler):
    def _request_path(self) -> str:
        return urlparse(self.path).path

    def _redirect_to_ops_slash(self) -> None:
        self.send_response(HTTPStatus.MOVED_PERMANENTLY)
        self.send_header("Location", "/ops/")
        self.end_headers()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_HEAD(self) -> None:
        if self._request_path() == "/ops":
            self._redirect_to_ops_slash()
            return

        if self._request_path() == "/api/content":
            self._send_json(CONTENT_FILE.read_text(encoding="utf-8"), include_body=False)
            return

        super().do_HEAD()

    def do_GET(self) -> None:
        if self._request_path() == "/ops":
            self._redirect_to_ops_slash()
            return

        if self._request_path() == "/api/content":
            self._send_json(CONTENT_FILE.read_text(encoding="utf-8"))
            return

        super().do_GET()

    def do_POST(self) -> None:
        if self._request_path() == "/api/profile-image":
            self._handle_profile_image_upload()
            return

        if self._request_path() != "/api/content":
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON payload")
            return

        if not isinstance(payload, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Payload must be a JSON object")
            return

        sanitized = sanitize_payload(payload)
        write_content(sanitized)
        self._send_json(json.dumps({"ok": True, "savedAt": os.path.getmtime(CONTENT_FILE)}))

    def _handle_profile_image_upload(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON payload")
            return

        if not isinstance(payload, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Payload must be a JSON object")
            return

        try:
            content = save_profile_image(payload)
        except ValueError as exc:
            self.send_error(HTTPStatus.BAD_REQUEST, str(exc))
            return

        self._send_json(json.dumps({"ok": True, "content": content}))

    def _send_json(self, body: str, include_body: bool = True) -> None:
        encoded = body.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if include_body:
            self.wfile.write(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Matthew Florek website with local ops support.")
    parser.add_argument("port", nargs="?", type=int, default=4000)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    handler = partial(SiteRequestHandler, directory=str(ROOT_DIR))
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        print(f"Serving Matthew Florek's site at http://{args.host}:{args.port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
