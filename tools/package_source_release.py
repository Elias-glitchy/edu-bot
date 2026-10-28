"""Create and verify a clean source-and-kit release ZIP.

This deliberately does not run the original kit generator, touch the local
database, or include the original archive as a duplicate.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "BUILD_BOT_ASTRA_6_SOURCE_RELEASE.zip"
DIRECTORIES = ("apps", "BUILD_BOT_ASTRA_6_BUILD_KIT", "docs", "planning", "tests", "tools")
FILES = (".gitignore", "BUILD_BOT_IMPLEMENTATION_PLAN.md", "package.json", "README.md")
EXCLUDED_PARTS = {"__pycache__", "node_modules", ".git", "data", "tmp"}


def selected_files() -> list[Path]:
    paths = [ROOT / name for name in FILES]
    for name in DIRECTORIES:
        paths.extend(path for path in (ROOT / name).rglob("*") if path.is_file())
    result = sorted(path for path in paths if path.exists() and not EXCLUDED_PARTS.intersection(path.relative_to(ROOT).parts))
    for path in result:
        if path.is_symlink() or ROOT not in path.resolve().parents:
            raise ValueError(f"Unsafe release input: {path}")
    return result


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def main() -> None:
    paths = selected_files()
    entries = [
        {"path": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size, "sha256": digest(path)}
        for path in paths
    ]
    manifest = {
        "release": "BUILD BOT ASTRA 6 source release 0.3.8",
        "status": "Working local alpha; not a production-ready or complete SaaS",
        "excluded": ["local database and tmp files", "original duplicate ZIP", "Git metadata", "Python cache"],
        "files": entries,
    }
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for path in paths:
            archive.write(path, path.relative_to(ROOT).as_posix())
        archive.writestr("RELEASE_MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
    with ZipFile(OUTPUT) as archive:
        bad_file = archive.testzip()
        if bad_file:
            raise RuntimeError(f"ZIP CRC check failed: {bad_file}")
        for entry in entries:
            payload = archive.read(entry["path"])
            if len(payload) != entry["bytes"] or hashlib.sha256(payload).hexdigest() != entry["sha256"]:
                raise RuntimeError(f"ZIP SHA-256 check failed: {entry['path']}")
    print(f"Verified {len(entries)} files in {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
