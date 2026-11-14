"""Package the checked dist/ tree as a reproducible, loadable extension ZIP."""

import hashlib
import json
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / "release"


def fail(message: str) -> None:
    raise SystemExit(f"package-release: {message}")


version = json.loads((ROOT / "package.json").read_text())["version"]
if not re.fullmatch(r"\d+(?:\.\d+){1,3}", version):
    fail("package version must be numeric")
for manifest in [ROOT / "public/manifest.json", DIST / "manifest.json"]:
    if json.loads(manifest.read_text())["version"] != version:
        fail(f"version mismatch in {manifest.relative_to(ROOT)}; rebuild first")

files = []
for source in sorted(DIST.rglob("*")):
    if source.is_symlink():
        fail(f"symlinks are not supported: {source.relative_to(DIST)}")
    if source.is_file():
        files.append((source.relative_to(DIST).as_posix(), source.read_bytes()))

sums_name = f"SHA256SUMS-v{version}.txt"
expected = "".join(f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in files)
sums = (ROOT / sums_name).read_text()
if sums != expected:
    fail(f"dist/ does not match {sums_name}; run npm run checksums")

OUT.mkdir(exist_ok=True)
archive = OUT / "authenticator.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as output:
    for name, data in files:
        entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        output.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=9)

with ZipFile(archive) as packaged:
    if packaged.testzip() is not None or "manifest.json" not in packaged.namelist():
        fail("ZIP integrity check failed or manifest.json is not at its root")

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(OUT / "authenticator.zip.sha256").write_text(f"{digest}  authenticator.zip\n")
(OUT / sums_name).write_text(sums)
print(f"Packaged {len(files)} files as {archive.relative_to(ROOT)} ({archive.stat().st_size} bytes)")
print(f"SHA256: {digest}")
