#!/usr/bin/env zsh
# ローカルを https で配信する。
#
# なぜ必要か:
#   既定のマニフェストを出しているポータルは、Referer が http:// で始まる要求を
#   403 で弾く（2026-09-12 実測）。python3 -m http.server は http なので、
#   ブラウザが送る Referer も http になり、マニフェストが読めない。
#   https で配信すれば Referer も https になり、通る。
#
# 使い方:
#   zsh serve-https.zsh [ポート]      # 既定 8443
#   → https://localhost:8443/ を開く。自己署名なので警告が出る。「詳細」→「アクセスする」。
set -euo pipefail

PORT="${1:-8443}"
HERE="${0:A:h}"
CERT="$HERE/.localhost-cert.pem"

if [[ ! -f "$CERT" ]]; then
  echo "自己署名の証明書を作ります（$CERT、365 日）"
  openssl req -x509 -newkey rsa:2048 -keyout "$CERT" -out "$CERT" -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
fi

echo "https://localhost:$PORT/ で配信します（Ctrl-C で停止）"
python3 -c "
import http.server, ssl, sys, os
os.chdir('$HERE')
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain('$CERT')
httpd = http.server.HTTPServer(('127.0.0.1', $PORT), http.server.SimpleHTTPRequestHandler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
"
