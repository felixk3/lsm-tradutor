"""Descarrega o modelo pronto do alfabeto (corre durante o `docker build`)."""
import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/nocontextdoruk/asl-landmark-mlp/resolve/main"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "assets")
OUT.mkdir(parents=True, exist_ok=True)

ok = True
for name in ("mlp_asl.onnx", "mlp_classes.json"):
    try:
        urllib.request.urlretrieve(f"{BASE}/{name}", OUT / name)
        print(f"✔ {name}")
    except Exception as e:  # o build continua; a app só desativa o alfabeto/números
        ok = False
        print(f"⚠ Não foi possível descarregar {name}: {e}")
if not ok:
    print("Aviso: os modelos 'Alfabeto' e 'Números' ficam indisponíveis. Volte a fazer o build com Internet.")
