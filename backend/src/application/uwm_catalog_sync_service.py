from __future__ import annotations

import html
import json
import re
import time
import urllib.parse
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import Course

_SUBJECT_LINK_PATTERN = re.compile(r'href="/courses/([a-z0-9_]+)/"', re.IGNORECASE)
_PAGE_TITLE_PATTERN = re.compile(r'<h1[^>]*class="page-title"[^>]*>(.*?)</h1>', re.IGNORECASE | re.DOTALL)
_COURSEBLOCK_PATTERN = re.compile(r'<div class="courseblock">(.*?)</div></div>', re.IGNORECASE | re.DOTALL)
_TITLE_PATTERN = re.compile(r"<strong>(.*?)</strong>", re.IGNORECASE | re.DOTALL)
_HOURS_PATTERN = re.compile(r'<p class="courseblockextra[^"]*"[^>]*>\s*([^<]*?cr\.)', re.IGNORECASE | re.DOTALL)
_DESC_PATTERN = re.compile(r'<p class="courseblockdesc[^"]*"[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL)
_SUBJECT_CODE_PATTERN = re.compile(r"\(([^()]+)\)\s*$")
_COURSE_ID_AND_TITLE_PATTERN = re.compile(r"^([A-Z&\s]+?\s+\d+[A-Z]*)\s+(.+)$")
_TAG_PATTERN = re.compile(r"<[^>]+>")
_PLACEHOLDER_INSTRUCTOR_KEYS = {"staff", "team", "tba", "tobeannounced", "variesbysection"}


@dataclass(frozen=True)
class UwmCatalogCourseRow:
    course_id: str
    title: str
    description: str | None
    subject: str
    year: int


@dataclass(frozen=True)
class UwmCatalogSyncResult:
    subject_count: int
    course_count_found: int
    inserted_count: int
    updated_professor_count: int
    failed_subject_count: int


def _clean_html_text(value: str) -> str:
    no_tags = _TAG_PATTERN.sub(" ", value)
    unescaped = html.unescape(no_tags).replace("\xa0", " ")
    return re.sub(r"\s+", " ", unescaped).strip()


def _normalize_course_id(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().upper()


def _normalize_instructor(value: object) -> str | None:
    if value is None:
        return None
    cleaned = _clean_html_text(str(value))
    if not cleaned:
        return None
    normalized_key = re.sub(r"[^a-z]", "", cleaned.lower())
    if normalized_key in _PLACEHOLDER_INSTRUCTOR_KEYS:
        return None
    return cleaned


def _parse_subject_code_from_title(page_title: str) -> str:
    match = _SUBJECT_CODE_PATTERN.search(page_title)
    if match is None:
        return "UNKNOWN"
    return _clean_html_text(match.group(1))


def _parse_course_rows_from_subject_html(subject_html: str, year: int) -> list[UwmCatalogCourseRow]:
    page_title_match = _PAGE_TITLE_PATTERN.search(subject_html)
    subject_code = _parse_subject_code_from_title(page_title_match.group(1)) if page_title_match else "UNKNOWN"

    rows: list[UwmCatalogCourseRow] = []
    for block in _COURSEBLOCK_PATTERN.findall(subject_html):
        title_match = _TITLE_PATTERN.search(block)
        if title_match is None:
            continue

        raw_title = _clean_html_text(title_match.group(1))
        id_and_title_match = _COURSE_ID_AND_TITLE_PATTERN.match(raw_title)
        if id_and_title_match is None:
            continue

        course_id = _normalize_course_id(id_and_title_match.group(1))
        title = id_and_title_match.group(2).strip()
        if not course_id or not title:
            continue

        hours_match = _HOURS_PATTERN.search(block)
        desc_match = _DESC_PATTERN.search(block)
        description_parts: list[str] = []
        if hours_match is not None:
            description_parts.append(_clean_html_text(hours_match.group(1)))
        if desc_match is not None:
            description_parts.append(_clean_html_text(desc_match.group(1)))
        description = " ".join(part for part in description_parts if part).strip() or None

        rows.append(
            UwmCatalogCourseRow(
                course_id=course_id,
                title=title,
                description=description,
                subject=subject_code,
                year=year,
            )
        )
    return rows


def _extract_subject_slugs(index_html: str) -> list[str]:
    seen: set[str] = set()
    slugs: list[str] = []
    for slug in _SUBJECT_LINK_PATTERN.findall(index_html):
        normalized = slug.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        slugs.append(normalized)
    return slugs


def _fetch_all_subject_pages(
    base_url: str,
    subject_slugs: Iterable[str],
    timeout_seconds: float,
) -> tuple[dict[str, str], list[str]]:
    pages_by_subject: dict[str, str] = {}
    failed_subjects: list[str] = []
    timeout = httpx.Timeout(timeout_seconds)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for slug in subject_slugs:
            last_error: Exception | None = None
            for attempt in range(3):
                try:
                    response = client.get(
                        f"{base_url}/courses/{slug}/",
                        headers={"User-Agent": "StudySyncCatalogSync/1.0"},
                    )
                    response.raise_for_status()
                    pages_by_subject[slug] = response.text
                    last_error = None
                    break
                except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectError) as error:
                    last_error = error
                    if attempt < 2:
                        time.sleep(0.35 * (attempt + 1))
                        continue
                except httpx.HTTPStatusError as error:
                    last_error = error
                    break

            if last_error is not None:
                failed_subjects.append(slug)
    return pages_by_subject, failed_subjects


def _fetch_instructors_by_course_id(
    *,
    base_url: str,
    subject_codes: Iterable[str],
    timeout_seconds: float,
) -> dict[str, str]:
    timeout = httpx.Timeout(timeout_seconds)
    instructors_by_course: dict[str, Counter[str]] = defaultdict(Counter)

    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for subject_code in subject_codes:
            if not subject_code:
                continue

            search_payload = {
                "other": {"srcdb": "999999"},
                "criteria": [{"field": "subject", "value": subject_code}],
            }
            request_body = urllib.parse.quote(json.dumps(search_payload))
            request_url = (
                f"{base_url}/course-search/api/?page=fose&route=search&srcdb=999999"
                f"&subject={urllib.parse.quote(subject_code)}"
            )

            last_error: Exception | None = None
            for attempt in range(3):
                try:
                    response = client.post(
                        request_url,
                        content=request_body,
                        headers={
                            "Content-Type": "application/json",
                            "User-Agent": "StudySyncCatalogSync/1.0",
                        },
                    )
                    response.raise_for_status()
                    payload = response.json()
                    results = payload.get("results", [])
                    if isinstance(results, list):
                        for item in results:
                            if not isinstance(item, dict):
                                continue
                            course_id = _normalize_course_id(str(item.get("code", "")))
                            instructor = _normalize_instructor(item.get("instr"))
                            if not course_id or not instructor:
                                continue
                            instructors_by_course[course_id][instructor] += 1
                    last_error = None
                    break
                except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectError, httpx.HTTPError, ValueError) as error:
                    last_error = error
                    if attempt < 2:
                        time.sleep(0.35 * (attempt + 1))
                        continue

            if last_error is not None:
                continue

    selected_instructors: dict[str, str] = {}
    for course_id, candidates in instructors_by_course.items():
        ranked = sorted(candidates.items(), key=lambda item: (-item[1], item[0].lower()))
        if ranked:
            selected_instructors[course_id] = ranked[0][0]
    return selected_instructors


def sync_uwm_catalog_courses(
    db: Session,
    *,
    base_url: str,
    timeout_seconds: float,
    max_subjects: int | None = None,
) -> UwmCatalogSyncResult:
    index_response = httpx.get(f"{base_url}/courses/", timeout=timeout_seconds, follow_redirects=True)
    index_response.raise_for_status()
    subject_slugs = _extract_subject_slugs(index_response.text)
    if max_subjects is not None:
        subject_slugs = subject_slugs[:max_subjects]

    pages_by_subject, failed_subjects = _fetch_all_subject_pages(
        base_url=base_url,
        subject_slugs=subject_slugs,
        timeout_seconds=timeout_seconds,
    )

    current_year = datetime.now(timezone.utc).year
    parsed_rows: list[UwmCatalogCourseRow] = []
    for subject_slug in subject_slugs:
        subject_html = pages_by_subject.get(subject_slug, "")
        parsed_rows.extend(_parse_course_rows_from_subject_html(subject_html, year=current_year))

    deduped_rows_by_id: dict[str, UwmCatalogCourseRow] = {}
    for row in parsed_rows:
        deduped_rows_by_id.setdefault(row.course_id, row)

    deduped_rows = list(deduped_rows_by_id.values())
    subject_codes = sorted({row.subject for row in deduped_rows if row.subject and row.subject != "UNKNOWN"})
    instructors_by_course_id = _fetch_instructors_by_course_id(
        base_url=base_url,
        subject_codes=subject_codes,
        timeout_seconds=timeout_seconds,
    )

    candidate_ids = [row.course_id for row in deduped_rows]
    existing_rows_by_id = (
        {
            row.course_id: row
            for row in db.scalars(select(Course).where(Course.course_id.in_(candidate_ids))).all()
        }
        if candidate_ids
        else {}
    )

    inserted_count = 0
    updated_professor_count = 0
    for row in deduped_rows:
        existing_row = existing_rows_by_id.get(row.course_id)
        instructor = instructors_by_course_id.get(row.course_id)

        if existing_row is not None:
            if (existing_row.professor is None or not existing_row.professor.strip()) and instructor:
                existing_row.professor = instructor
                updated_professor_count += 1
            continue

        db.add(
            Course(
                course_id=row.course_id,
                title=row.title,
                description=row.description,
                professor=instructor,
                subject=row.subject,
                year=row.year,
            )
        )
        inserted_count += 1

    if inserted_count > 0 or updated_professor_count > 0:
        db.commit()

    return UwmCatalogSyncResult(
        subject_count=len(subject_slugs),
        course_count_found=len(deduped_rows),
        inserted_count=inserted_count,
        updated_professor_count=updated_professor_count,
        failed_subject_count=len(failed_subjects),
    )
