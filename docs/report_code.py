#!/usr/bin/env python3
"""
Pull real source listings out of the project for the report.

Listings are read from the working tree rather than retyped, so a listing in
the report cannot drift away from the code it claims to show.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def excerpt(relative_path, first_line, last_line, dedent=True):
    """Return lines first..last of a file, inclusive, 1-indexed."""
    text = (ROOT / relative_path).read_text(encoding="utf-8").splitlines()
    chunk = text[first_line - 1:last_line]

    while chunk and not chunk[0].strip():
        chunk.pop(0)
    while chunk and not chunk[-1].strip():
        chunk.pop()

    if dedent and chunk:
        indents = [len(l) - len(l.lstrip()) for l in chunk if l.strip()]
        trim = min(indents) if indents else 0
        chunk = [l[trim:] if l.strip() else "" for l in chunk]

    return "\n".join(chunk)


def strip_comments(text, markers=("//", "*", "/*", "#")):
    """Drop comment-only lines, so a listing shows code rather than prose."""
    kept = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if any(stripped.startswith(m) for m in markers):
            continue
        kept.append(line)
    while kept and kept[-1] == "":
        kept.pop()
    return "\n".join(kept)


def listing(relative_path, first_line, last_line, clean=True):
    text = excerpt(relative_path, first_line, last_line)
    return strip_comments(text) if clean else text


def function_at(relative_path, signature, max_lines=90, clean=True):
    """
    Return a whole function, located by a fragment of its declaration and
    closed by brace matching.

    Hand-picked line numbers drift the moment the file is edited and silently
    produce a listing that starts or stops mid-statement, so the extent is
    computed from the source instead.
    """
    lines = (ROOT / relative_path).read_text(encoding="utf-8").splitlines()

    start = None
    for index, line in enumerate(lines):
        if signature in line:
            start = index
            break
    if start is None:
        raise ValueError(f"{signature!r} not found in {relative_path}")

    # The body closes at the first line whose brace depth returns to zero and
    # whose closing brace sits at the declaration's own indentation. Depth
    # alone is not enough: a destructured or typed parameter can open and
    # close a brace on the signature line itself.
    base_indent = len(lines[start]) - len(lines[start].lstrip())
    depth = 0
    opened = False
    end = start
    for index in range(start, min(len(lines), start + max_lines)):
        line = lines[index]
        for char in line:
            if char == "{":
                depth += 1
                opened = True
            elif char == "}":
                depth -= 1
        end = index
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if opened and depth == 0 and stripped.startswith("}") and indent == base_indent:
            break

    chunk = lines[start:end + 1]
    if chunk:
        indents = [len(l) - len(l.lstrip()) for l in chunk if l.strip()]
        trim = min(indents) if indents else 0
        chunk = [l[trim:] if l.strip() else "" for l in chunk]

    text = "\n".join(chunk)
    return strip_comments(text) if clean else text
