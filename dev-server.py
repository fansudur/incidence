#!/usr/bin/env python3
"""开发用静态服务器：和 `python -m http.server` 一样，但对每个响应加 no-store 头。
原因：预览浏览器会缓存 ES 模块，普通 reload 不刷新 src/*.js，改完看不到效果。
注意：必须用 ThreadingHTTPServer（多线程），否则浏览器 keep-alive 长连接会卡死单线程 server。
用法：py dev-server.py [port]   (默认 8765，服务本脚本所在目录 = Incidence 根)
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory=ROOT)
http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
    print(f"no-cache dev server on http://localhost:{PORT}  (serving {ROOT})")
    httpd.serve_forever()
