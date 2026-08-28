# -*- coding: utf-8 -*-
"""GGYEMSSBBYOKK 빌드 — src/*.js (ES 모듈) 를 의존성 없는 단일 index.html 로 굽는다.

왜 빌드 단계가 있나:
  브라우저는 file:// 에서 ES 모듈을 CORS 로 막는다. 소스는 진짜 모듈로 두고 싶고,
  결과물은 파일을 더블클릭해도 돌아가야 해서, 모듈을 IIFE 로 감싸 한 파일에 넣는다.
  번들러도 의존성도 없다. python3 build.py 한 줄이면 된다.

규칙 (이걸 지키면 번들러가 단순하게 유지된다):
  - import 는 `import { a, b } from './x.js';` 형태만 쓴다 (default·별칭·네임스페이스 금지)
  - export 는 `export [async] const/let/var/function/class 이름` 형태만 쓴다
  - 모듈 순서는 아래 MODULES 목록이 정한다 (의존성 순)
"""
import io, os, re, sys

SRC = 'src'
OUT = 'index.html'
SHELL = 'shell.html'

# 의존성 순서. 새 파일을 만들면 여기에 추가한다.
MODULES = [
    'config.js',
    'util/dom.js',
    'util/svg.js',
    'theory/notes.js',
    'theory/intervals.js',
    'theory/chords.js',
    'theory/voicing.js',
    'theory/fretboard.js',
    'theory/keyboard.js',
    'audio/engine.js',
    'audio/metronome.js',
    'audio/pitch.js',
    'audio/tuner.js',
    'render/staff.js',
    'render/fret.js',
    'render/keys.js',
    'ui/chordbar.js',
    'ui/inst-fret.js',
    'ui/inst-bass.js',
    'ui/inst-keys.js',
    'ui/tuner.js',
    'ui/metronome.js',
    'ui/shell.js',
    'main.js',
]

IMPORT_RE = re.compile(r'^import\s*\{([^}]*)\}\s*from\s*[\'"][^\'"]+[\'"];?', re.M)
BAD_IMPORT_RE = re.compile(r'^import\s+(?!\{)', re.M)
EXPORT_DECL_RE = re.compile(r'^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)', re.M)
BAD_EXPORT_RE = re.compile(r'^export\s*(?:\{|default)', re.M)


def read(path):
    return io.open(os.path.join(SRC, path), encoding='utf-8').read()


def write(path, text):
    io.open(path, 'w', encoding='utf-8', newline='\n').write(text)


def transform(name, source):
    """모듈 하나를 IIFE 로 감싸고 import/export 를 공용 레지스트리로 바꾼다."""
    if BAD_IMPORT_RE.search(source):
        raise SystemExit('%s: default/네임스페이스 import 는 지원하지 않는다' % name)
    if BAD_EXPORT_RE.search(source):
        raise SystemExit('%s: export {} / export default 는 지원하지 않는다' % name)

    names = EXPORT_DECL_RE.findall(source)
    body = IMPORT_RE.sub(lambda m: 'const {%s} = __M;' % m.group(1), source)
    body = re.sub(r'^export\s+', '', body, flags=re.M)

    lines = ['// ── %s ─────────────────────────────' % name, '(function () {']
    lines.append(indent(body))
    if names:
        assign = ' '.join('__M.%s = %s;' % (n, n) for n in names)
        lines.append('  ' + assign)
    lines.append('})();')
    return '\n'.join(lines), names


def indent(text):
    return '\n'.join(('  ' + line) if line.strip() else line for line in text.split('\n'))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    os.chdir(here)

    parts = ["'use strict';", 'const __M = Object.create(null);']
    exported = {}
    for name in MODULES:
        code, names = transform(name, read(name))
        for n in names:
            if n in exported:
                raise SystemExit('이름 충돌: %s 가 %s 와 %s 양쪽에 있다' % (n, exported[n], name))
            exported[n] = name
        parts.append(code)

    bundle = '\n\n'.join(parts) + '\n'
    shell = io.open(SHELL, encoding='utf-8').read()
    page = shell.replace('/* BUNDLE */', bundle)
    write(OUT, page)

    kb = len(page.encode('utf-8')) / 1024.0
    print('%s  %.1f KB  · 모듈 %d개 · export %d개' % (OUT, kb, len(MODULES), len(exported)))


if __name__ == '__main__':
    main()
