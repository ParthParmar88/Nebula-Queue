"""Turning an uploaded file into searchable chunks.

Chunks never cross page boundaries, so every citation can point at one page. Neighbouring
chunks overlap slightly, so a sentence split across two chunks is still findable."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

MAX_PAGES = 500
MAX_CHUNKS = 400  # cost guard: embedding is cheap, but not free
CHUNK_CHARS = 1200  # ≈ 300 tokens
OVERLAP_CHARS = 200


@dataclass(frozen=True)
class Page:
    number: int | None  # 1-based; None for plain-text files
    text: str


@dataclass(frozen=True)
class Chunk:
    index: int
    page: int | None
    text: str


def extract_pages(data: bytes, content_type: str) -> list[Page]:
    """Text per page. Raises ValueError with a user-facing message when there is none."""
    if content_type == "application/pdf":
        pages = _pdf_pages(data)
    else:
        pages = [Page(None, data.decode("utf-8", errors="replace"))]

    pages = [Page(p.number, _normalize(p.text)) for p in pages]
    pages = [p for p in pages if p.text]
    if not pages:
        raise ValueError(
            "No text could be extracted. If this is a scanned PDF, it needs OCR before it can be searched."
        )
    return pages


def _pdf_pages(data: bytes) -> list[Page]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError("This PDF is password-protected.")
        if len(reader.pages) > MAX_PAGES:
            raise ValueError(f"This PDF has {len(reader.pages)} pages; the limit is {MAX_PAGES}.")
        return [Page(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
    except PdfReadError as err:
        raise ValueError(f"The PDF couldn't be read: {err}") from None


def _normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_pages(pages: list[Page], *, max_chars: int = CHUNK_CHARS, overlap: int = OVERLAP_CHARS) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page in pages:
        for text in _split(page.text, max_chars, overlap):
            chunks.append(Chunk(index=len(chunks), page=page.number, text=text))
            if len(chunks) > MAX_CHUNKS:
                raise ValueError(f"This document is too large to index (over {MAX_CHUNKS} chunks).")
    return chunks


def _split(text: str, max_chars: int, overlap: int) -> list[str]:
    """Greedy packing of paragraphs (then sentences, then words) into chunks ≤ max_chars."""
    pieces = _pieces(text, max_chars)
    chunks: list[str] = []
    current = ""
    for piece in pieces:
        candidate = f"{current}\n{piece}" if current else piece
        if len(candidate) <= max_chars:
            current = candidate
            continue
        chunks.append(current)
        tail = _tail(current, overlap)
        current = f"{tail} {piece}" if tail and len(tail) + 1 + len(piece) <= max_chars else piece
    if current:
        chunks.append(current)
    return chunks


def _pieces(text: str, max_chars: int) -> list[str]:
    pieces: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) <= max_chars:
            pieces.append(paragraph)
            continue
        for sentence in re.split(r"(?<=[.!?])\s+", paragraph):
            while len(sentence) > max_chars:  # no sentence breaks: cut at a word boundary
                cut = sentence.rfind(" ", 0, max_chars)
                cut = cut if cut > max_chars // 2 else max_chars
                pieces.append(sentence[:cut].strip())
                sentence = sentence[cut:].strip()
            if sentence:
                pieces.append(sentence)
    return pieces


def _tail(text: str, size: int) -> str:
    """The last ~size characters, starting at a word boundary."""
    if size <= 0 or len(text) <= size:
        return text if size > 0 else ""
    tail = text[-size:]
    space = tail.find(" ")
    return tail[space + 1 :] if space != -1 else tail
