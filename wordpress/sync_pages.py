#!/usr/bin/env python3
"""Legt die Seiten aus pages.json als Entwürfe in WordPress an oder aktualisiert sie.

Veröffentlichte Seiten werden nie verändert: gesucht wird nur unter Entwürfen
mit der gleichen wisi_route (braucht das aktive Plugin). Anmeldung über eine Cookie-Datei (curl -c) einer
angemeldeten Admin-Sitzung.

    python3 wordpress/sync_pages.py COOKIEFILE [https://fensterdienst.ch]
"""
import http.cookiejar
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = ('<!-- wp:paragraph --><p>Diese Seite zeigt die neue Website '
           '(Plugin «Wisi Fensterdienst – Website», Route <code>{route}</code>).</p><!-- /wp:paragraph -->')


def main():
    cookies, base = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "https://fensterdienst.ch")
    jar = http.cookiejar.MozillaCookieJar(cookies)
    jar.load(ignore_discard=True, ignore_expires=True)
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    nonce = op.open(base + "/wp-admin/admin-ajax.php?action=rest-nonce").read().decode().strip()

    def api(path, data=None):
        req = urllib.request.Request(base + "/wp-json/wp/v2/" + path, method="POST" if data else "GET",
                                     data=json.dumps(data).encode() if data else None,
                                     headers={"X-WP-Nonce": nonce, "Content-Type": "application/json"})
        return json.loads(op.open(req).read())

    # Slugs that published pages still use get "-2" on drafts, so drafts are matched by route.
    drafts = {(x.get("meta") or {}).get("wisi_route"): x["id"]
              for x in api("pages?status=draft&per_page=100&context=edit&_fields=id,meta")}
    for p in json.load(open(os.path.join(HERE, "pages.json"), encoding="utf-8")):
        data = {
            "title": p["title"], "slug": p["slug"], "status": "draft",
            "content": CONTENT.format(route=p["route"]),
            "meta": {"wisi_route": p["route"], "wisi_seo_title": p["seo_title"], "wisi_seo_desc": p["seo_desc"]},
        }
        found = drafts.get(p["route"])
        r = api("pages/%d" % found, data) if found else api("pages", data)
        meta_ok = (r.get("meta") or {}).get("wisi_route") == p["route"]
        print("%-6s %5d  %-18s %s%s" % ("update" if found else "neu", r["id"], p["slug"], r["link"],
                                        "" if meta_ok else "   (ohne Plugin-Felder)"))


if __name__ == "__main__":
    main()
