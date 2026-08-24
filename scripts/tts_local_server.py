#!/usr/bin/env python3
"""Local Kokoro TTS server for Everheart offline voice.

Loads the Kokoro pipeline once per language and serves audio over HTTP, so
streaming sentence-by-sentence playback doesn't reload the model each call.

Usage:
    .venv-tts/bin/python scripts/tts_local_server.py [--port 8765]

Endpoints:
    GET  /health           -> {"ok": true}
    POST /tts              -> audio/wav bytes
         {"text": "...", "voice": "af_heart"}

Voice prefixes: af_/am_ = English, bf_/bm_ = British English, zf_/zm_ = Chinese.
First run downloads the Kokoro-82M model from HuggingFace (needs network once).
"""

import argparse
import json
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LANG_BY_VOICE_PREFIX = {
    "af_": "a",
    "am_": "a",
    "bf_": "b",
    "bm_": "b",
    "zf_": "z",
    "zm_": "z",
}

SAMPLE_RATE = 24000
_pipelines: dict[str, object] = {}


def get_pipeline(lang: str):
    if lang not in _pipelines:
        from kokoro import KPipeline

        _pipelines[lang] = KPipeline(lang_code=lang)
    return _pipelines[lang]


def synthesize(text: str, voice: str) -> bytes:
    prefix = voice[:3]
    if prefix not in LANG_BY_VOICE_PREFIX:
        raise ValueError(f"unsupported kokoro voice prefix: {voice}")
    pipeline = get_pipeline(LANG_BY_VOICE_PREFIX[prefix])

    import numpy as np
    import soundfile as sf

    frames: list[np.ndarray] = []
    for _graphemes, _phonemes, audio in pipeline(
        text,
        voice=voice,
        speed=1.0,
        split_pattern=r"[.!?。！？]",
    ):
        arr = audio.numpy() if hasattr(audio, "numpy") else audio
        frames.append(np.asarray(arr, dtype=np.float32))

    if not frames:
        raise ValueError("kokoro produced no audio")
    merged = np.concatenate(frames)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fh:
        sf.write(fh.name, merged, SAMPLE_RATE)
        data = Path(fh.name).read_bytes()
    return data


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write(f"[tts-local] {fmt % args}\n")

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/health"):
            self._json(200, {"ok": True, "sample_rate": SAMPLE_RATE})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/tts"):
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
            text = str(body.get("text", "")).strip()
            voice = str(body.get("voice", "")).strip()
            if not text:
                self._json(400, {"error": "text required"})
                return
            if not voice:
                self._json(400, {"error": "voice required"})
                return
            data = synthesize(text, voice)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except ValueError as exc:
            self._json(400, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {"error": f"kokoro failed: {exc}"})


def main() -> int:
    parser = argparse.ArgumentParser(description="Everheart local Kokoro TTS server")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    try:
        import kokoro  # noqa: F401
    except ImportError:
        print(
            "kokoro not installed. Run: "
            ".venv-tts/bin/pip install kokoro soundfile onnxruntime 'misaki[zh]'",
            file=sys.stderr,
        )
        return 2

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[tts-local] listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
