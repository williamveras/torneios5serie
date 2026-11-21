#!/bin/sh
# Run on the central database VPS only, after the public_translations migration.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime=/opt/torneios-translation
mkdir -p "$runtime"
if [ ! -x "$runtime/venv/bin/python" ]; then
  python3 -m venv "$runtime/venv"
fi
"$runtime/venv/bin/pip" install 'torch==2.7.1+cpu' --index-url https://download.pytorch.org/whl/cpu
"$runtime/venv/bin/pip" install 'argostranslate==1.10.0'
"$runtime/venv/bin/python" - <<'PY'
import argostranslate.package as package
package.update_package_index()
installed={(p.from_code,p.to_code) for p in package.get_installed_packages()}
available=package.get_available_packages()
for pair in [('pt','en'),('en','es'),('en','fr'),('en','it')]:
    if pair not in installed:
        model=next(p for p in available if (p.from_code,p.to_code)==pair)
        package.install_from_path(model.download())
PY
"$runtime/venv/bin/pip" freeze > "$runtime/requirements.lock"
install -m 644 "$root/ops/translation_worker.py" "$runtime/translation_worker.py"
install -m 644 "$root/ops/torneios-translation.service" /etc/systemd/system/
install -m 644 "$root/ops/torneios-translation.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now torneios-translation.timer
