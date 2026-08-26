# -*- coding: utf-8 -*-
"""NetForge 빌드 — src/* 를 의존성 없는 단일 HTML 로 묶는다."""
import io, os

SRC = 'src'
JS = ['20-catalog.js','30-core.js','40-engine.js','50-render.js','55-context.js','60-ui.js','70-generator.js','80-app.js']

def rd(n):
    return io.open(os.path.join(SRC, n), encoding='utf-8').read()

def wr(path, text):
    io.open(path, 'w', encoding='utf-8', newline='\n').write(text)

js = '\n'.join(rd(n) for n in JS)
wr('netforge.bundle.js', js)

body = rd('00-head.htmlpart') + '\n' + rd('10-body.htmlpart') + '\n<script>\n' + js + '\n</script>\n'

# 1) 아티팩트용 (호스트가 doctype/head/body 로 감싼다)
wr('netforge.html', body)

# 2) GitHub Pages / Vercel / 로컬 file:// 용 완전한 문서
page = ('<!doctype html>\n<html lang="ko">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="description" content="전산망 구성도를 그리고 실제 장비 동작으로 검증하는 시뮬레이터. 구성 전체가 URL 에 저장됩니다.">\n'
        '<meta name="color-scheme" content="light dark">\n'
        + body.replace('<meta charset="utf-8">\n', '', 1) +
        '</head>\n</html>\n')
# <head> 안에 들어가야 할 것과 <body> 로 갈 것을 분리
head_end = page.find('</style>') + len('</style>')
page = page[:head_end] + '\n</head>\n<body>\n' + page[head_end:]
page = page.replace('</head>\n</html>\n', '</body>\n</html>\n')
wr('index.html', page)

wr('.nojekyll', '')
wr('vercel.json', io.open('deploy/vercel.json', encoding='utf-8').read()
   if os.path.exists('deploy/vercel.json') else
   '{\n  "cleanUrls": true,\n  "trailingSlash": false\n}\n')

kb = lambda s: len(s.encode('utf-8'))/1024
print('index.html      %6.1f KB   (GitHub Pages / Vercel / file:// 로컬 실행)' % kb(page))
print('netforge.html   %6.1f KB   (Artifact 배포용)' % kb(body))
print('bundle js       %6.1f KB' % kb(js))
