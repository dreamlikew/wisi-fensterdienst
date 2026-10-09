(function () {
	// On-page editor for logged-in editors: click a text or a photo, change it, save.
	// Changes are stored in WordPress (REST wisi/v1/overrides) and shown to visitors by live.js.
	var W = window.WISI_WP, E = W.edit, L = window.WISI_LIVE;
	var NOEDIT = "script,style,template,noscript,svg,input,textarea,select,option,.wwa-msg,#wisi-ed";

	function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
	function clean(o) { o = clone(o); o.texts = o.texts && !Array.isArray(o.texts) ? o.texts : {}; o.images = o.images && !Array.isArray(o.images) ? o.images : {}; return o; }
	var saved = clean(W.overrides), draft = clone(saved), on = false, sel = null, root, bar, panel, toastEl;

	function dirty() { return JSON.stringify(draft) !== JSON.stringify(saved); }
	function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
	function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

	function api(path, body) {
		return fetch(E.rest + path, {
			method: "POST", credentials: "same-origin",
			headers: { "X-WP-Nonce": E.nonce, "Content-Type": "application/json" },
			body: JSON.stringify(body || {})
		}).then(function (r) {
			return r.json().catch(function () { return {}; }).then(function (j) {
				if (!r.ok) throw new Error(j.message || ("Fehler " + r.status));
				return j;
			});
		});
	}

	function toast(msg, bad) {
		toastEl.textContent = msg;
		toastEl.className = "wed-toast wed-show" + (bad ? " wed-bad" : "");
		clearTimeout(toastEl._t);
		toastEl._t = setTimeout(function () { toastEl.className = "wed-toast"; }, bad ? 6000 : 3000);
	}

	var previewT;
	function preview() { clearTimeout(previewT); previewT = setTimeout(function () { L.setOverrides(clone(draft)); }, 120); renderBar(); }

	// ---------- bar ----------
	function renderBar() {
		bar.innerHTML = "";
		if (!on) {
			var b = h("button", "wed-btn wed-main", "✎ Seite bearbeiten");
			b.onclick = function () { setOn(true); };
			bar.appendChild(b);
			return;
		}
		bar.appendChild(h("span", "wed-hint", "Text oder Foto anklicken"));
		var s = h("button", "wed-btn wed-main", dirty() ? "Speichern" : "Gespeichert");
		s.disabled = !dirty();
		s.onclick = save;
		bar.appendChild(s);
		if (dirty()) {
			var d = h("button", "wed-btn", "Verwerfen");
			d.onclick = function () { if (confirm("Alle ungespeicherten Änderungen verwerfen?")) { draft = clone(saved); L.setOverrides(clone(saved)); closePanel(); renderBar(); } };
			bar.appendChild(d);
		}
		var more = h("button", "wed-btn", "⋯");
		more.title = "Mehr";
		more.onclick = function () {
			var m = bar.querySelector(".wed-more");
			if (m) { m.remove(); return; }
			m = h("div", "wed-more");
			var u = h("button", "wed-link", "Letzte Speicherung rückgängig machen");
			u.onclick = undo;
			var a = h("a", "wed-link", "Zu WordPress");
			a.href = E.admin;
			m.appendChild(u); m.appendChild(a);
			bar.appendChild(m);
		};
		bar.appendChild(more);
		var f = h("button", "wed-btn", "Fertig");
		f.onclick = function () {
			if (dirty() && !confirm("Es gibt ungespeicherte Änderungen. Trotzdem beenden? (Die Änderungen bleiben sichtbar, bis Sie die Seite neu laden.)")) return;
			setOn(false);
		};
		bar.appendChild(f);
	}

	function setOn(v) {
		on = v;
		document.documentElement.classList.toggle("wisi-editing", v);
		if (!v) { closePanel(); clearHl(); }
		renderBar();
	}

	function save() {
		var s = bar.querySelector(".wed-main");
		if (s) { s.disabled = true; s.textContent = "Speichert…"; }
		api("overrides", draft).then(function (j) {
			saved = clean(j.overrides); draft = clone(saved);
			L.setOverrides(clone(saved));
			renderBar();
			toast("Gespeichert ✓");
		}).catch(function (e) { renderBar(); toast("Nicht gespeichert: " + e.message + " – bitte in WordPress neu anmelden und nochmals versuchen.", true); });
	}

	function undo() {
		if (!confirm("Die letzte Speicherung rückgängig machen? Die Seite zeigt danach wieder den Stand davor.")) return;
		api("undo").then(function (j) {
			saved = clean(j.overrides); draft = clone(saved);
			L.setOverrides(clone(saved)); closePanel(); renderBar();
			toast(j.undone ? "Rückgängig gemacht ✓" : "Es gibt nichts rückgängig zu machen.");
		}).catch(function (e) { toast("Fehler: " + e.message, true); });
	}

	// ---------- picking ----------
	function visible(el) { return !!(el && (el.offsetParent || el.getClientRects().length)); }
	function textNodes(el) {
		var out = [], tw = document.createTreeWalker(el, 4, null), n;
		while ((n = tw.nextNode())) {
			var p = n.parentElement;
			if (!L.norm(n.nodeValue) || !p || p.closest(NOEDIT) || !visible(p)) continue;
			out.push(n);
		}
		return out;
	}
	function hits(rects, x, y) {
		for (var i = 0; i < rects.length; i++) { var r = rects[i]; if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) return true; }
		return false;
	}
	// The text actually under the pointer (overlays and pointer-events:none don't matter).
	function textAt(x, y, target) {
		var rg = document.createRange(), tw = document.createTreeWalker(target, 4, null), n, seen = 0;
		while ((n = tw.nextNode()) && seen++ < 3000) {
			var p = n.parentElement;
			if (!L.norm(n.nodeValue) || !p || p.closest(NOEDIT) || !visible(p)) continue;
			rg.selectNodeContents(n);
			if (hits(rg.getClientRects(), x, y)) return n;
		}
		return null;
	}
	// The photo under the pointer, found by position: the smallest visible one wins.
	function imageAt(x, y) {
		var best = null, area = Infinity, els = document.querySelectorAll("img[data-wisi-orig], [data-wisi-orig][style*=url]");
		for (var i = 0; i < els.length; i++) {
			var e = els[i];
			if (e.closest("#wisi-ed") || !visible(e)) continue;
			var r = e.getBoundingClientRect();
			if (!hits([r], x, y) || getComputedStyle(e).visibility === "hidden" || +getComputedStyle(e).opacity === 0) continue;
			if (r.width * r.height < area) { area = r.width * r.height; best = e; }
		}
		return best;
	}
	function pick(target, x, y) {
		if (!target || target.closest(NOEDIT)) {
			if (target && target.closest(".wwa-msg, input, textarea, select")) return { kind: "form" };
			return null;
		}
		var n = textAt(x, y, target) || textAt(x, y, document.body);
		if (n) {
			// Whole paragraph or heading: climb out of inline tags like <strong>.
			var el = n.parentElement;
			while (el.parentElement && el.parentElement !== document.body && /^inline/.test(getComputedStyle(el).display) && !el.closest("a,button")) el = el.parentElement;
			var t = textNodes(el);
			if (t.length > 12) { el = n.parentElement; t = textNodes(el); }
			return { kind: "text", el: el, nodes: t.length ? t.slice(0, 12) : [n] };
		}
		var img = imageAt(x, y);
		if (img) return { kind: "img", el: img };
		return null;
	}

	var hl = null;
	function clearHl() { if (hl) hl.classList.remove("wisi-ed-hl"); hl = null; }
	function setHl(el) { if (hl === el) return; clearHl(); if (el) { hl = el; el.classList.add("wisi-ed-hl"); } }

	function inUi(e) { return e.target && e.target.closest && e.target.closest("#wisi-ed"); }
	function block(e) { if (!on || inUi(e)) return; e.preventDefault(); e.stopImmediatePropagation(); }
	["pointerdown", "mousedown", "mouseup", "pointerup", "dblclick", "submit", "contextmenu"].forEach(function (t) { window.addEventListener(t, block, true); });
	window.addEventListener("click", function (e) {
		if (!on || inUi(e)) return;
		e.preventDefault(); e.stopImmediatePropagation();
		var p = pick(e.target, e.clientX, e.clientY);
		if (p && p.kind === "form") { toast("Dieser Teil wird vom Formular erzeugt und kann hier nicht geändert werden.", true); return; }
		if (!p) { toast("Hier gibt es keinen Text und kein Foto zum Ändern."); return; }
		setHl(p.el);
		if (p.kind === "text") openText(p); else openImg(p.el);
	}, true);
	window.addEventListener("mouseover", function (e) {
		if (!on || inUi(e) || (panel && panel.classList.contains("wed-open"))) return;
		var p = pick(e.target, e.clientX, e.clientY);
		setHl(p && p.el ? p.el : null);
	}, true);
	window.addEventListener("beforeunload", function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });

	// ---------- panel ----------
	function closePanel() { if (panel) { panel.className = "wed-panel"; panel.innerHTML = ""; } sel = null; clearHl(); }
	function head(title) {
		panel.innerHTML = "";
		panel.className = "wed-panel wed-open";
		var top = h("div", "wed-top");
		top.appendChild(h("strong", null, title));
		var x = h("button", "wed-x", "×");
		x.title = "Schliessen";
		x.onclick = closePanel;
		top.appendChild(x);
		panel.appendChild(top);
	}
	function countOnPage(orig) {
		var n = 0, tw = document.createTreeWalker(document.body, 4, null), t;
		while ((t = tw.nextNode())) if (t.parentElement && !t.parentElement.closest("#wisi-ed") && L.origOf(t) === orig) n++;
		return n;
	}

	function openText(p) {
		head("Text ändern");
		var keys = [];
		p.nodes.forEach(function (n) { var k = L.origOf(n); if (keys.indexOf(k) < 0) keys.push(k); });
		keys.forEach(function (k) {
			var box = h("div", "wed-field");
			var ta = h("textarea", "wed-ta");
			ta.value = draft.texts[k] != null ? draft.texts[k] : k;
			ta.rows = Math.min(8, Math.max(2, Math.ceil(ta.value.length / 38)));
			var info = h("div", "wed-orig");
			function upd() {
				var changed = draft.texts[k] != null;
				info.innerHTML = changed ? "Original: <em>" + esc(k) + "</em> " : "";
				if (changed) {
					var r = h("button", "wed-link", "Original wiederherstellen");
					r.onclick = function () { ta.value = k; delete draft.texts[k]; upd(); preview(); };
					info.appendChild(r);
				}
			}
			ta.oninput = function () {
				var v = ta.value.replace(/\r/g, "");
				if (L.norm(v) === k) delete draft.texts[k]; else draft.texts[k] = v;
				upd(); preview();
			};
			box.appendChild(ta);
			box.appendChild(info);
			var c = countOnPage(k);
			if (c > 1) box.appendChild(h("div", "wed-note", "Dieser Text kommt auf der Seite " + c + "-mal vor und wird überall geändert."));
			panel.appendChild(box);
			upd();
		});
		panel.appendChild(h("p", "wed-note", "Die Änderung ist sofort sichtbar. Online geht sie erst mit «Speichern»."));
		var first = panel.querySelector("textarea");
		if (first) first.focus();
	}

	function openImg(el) {
		var id = el.dataset.wisiOrig;
		head("Foto ändern");
		if (!id) { panel.appendChild(h("p", "wed-note", "Dieses Bild ist Teil des Designs und kann nicht ersetzt werden.")); return; }
		var cur = draft.images[id] || {};
		var pv = h("img", "wed-pv");
		pv.src = el.tagName === "IMG" ? (el.currentSrc || el.src) : (/url\(["']?([^"')]+)/.exec(el.style.backgroundImage) || [])[1];
		panel.appendChild(pv);

		function setImg(url, alt) {
			draft.images[id] = { url: url, alt: alt != null ? alt : (alt0.value || "") };
			pv.src = url;
			preview(); renderRow();
		}
		var alt0 = h("input", "wed-in");
		alt0.placeholder = "Bildbeschreibung für Google (z. B. «Martin Röllin repariert ein Holzfenster»)";
		alt0.value = cur.alt || (el.getAttribute("alt") || "");
		alt0.oninput = function () { if (draft.images[id]) { draft.images[id].alt = alt0.value; preview(); } };

		var row = h("div", "wed-row");
		function renderRow() {
			row.innerHTML = "";
			var up = h("label", "wed-btn wed-main", "Foto hochladen");
			var file = h("input");
			file.type = "file"; file.accept = "image/jpeg,image/png,image/webp";
			file.style.display = "none";
			file.onchange = function () { if (file.files[0]) upload(file.files[0]); };
			up.appendChild(file);
			row.appendChild(up);
			var lib = h("button", "wed-btn", "Aus der Mediathek");
			lib.onclick = function () { library(1); };
			row.appendChild(lib);
			if (draft.images[id]) {
				var r = h("button", "wed-link", "Original wiederherstellen");
				r.onclick = function () { delete draft.images[id]; pv.src = el.dataset.wisiOrigSrc || pv.src; preview(); renderRow(); };
				row.appendChild(r);
			}
		}
		renderRow();
		panel.appendChild(row);
		panel.appendChild(h("label", "wed-lbl", "Bildbeschreibung"));
		panel.appendChild(alt0);
		var grid = h("div", "wed-grid");
		panel.appendChild(grid);
		panel.appendChild(h("p", "wed-note", "Tipp: Querformat-Fotos wie das Original sehen am besten aus. Grosse Fotos werden beim Hochladen automatisch verkleinert."));

		function upload(f) {
			if (f.size > 15 * 1024 * 1024) { toast("Das Foto ist zu gross (max. 15 MB).", true); return; }
			toast("Foto wird hochgeladen…");
			var name = (f.name || "foto.jpg").replace(/[^A-Za-z0-9._-]+/g, "-");
			fetch(E.media, {
				method: "POST", credentials: "same-origin",
				headers: { "X-WP-Nonce": E.nonce, "Content-Type": f.type || "image/jpeg", "Content-Disposition": 'attachment; filename="' + name + '"' },
				body: f
			}).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || r.status); return j; }); })
				.then(function (j) { setImg(j.source_url); toast("Foto hochgeladen ✓ – zum Veröffentlichen «Speichern» klicken."); })
				.catch(function (e) { toast("Hochladen fehlgeschlagen: " + e.message, true); });
		}
		function library(page) {
			if (page === 1) grid.innerHTML = "";
			var more = grid.querySelector(".wed-moreimg");
			if (more) more.remove();
			fetch(E.media + "?media_type=image&per_page=24&page=" + page + "&_fields=id,source_url,alt_text,media_details", { credentials: "same-origin", headers: { "X-WP-Nonce": E.nonce } })
				.then(function (r) { var tp = +r.headers.get("X-WP-TotalPages") || 1; return r.json().then(function (j) { return { j: j, tp: tp }; }); })
				.then(function (res) {
					res.j.forEach(function (m) {
						var s = m.media_details && m.media_details.sizes || {};
						var th = h("img", "wed-th");
						th.src = (s.thumbnail || s.medium || {}).source_url || m.source_url;
						th.title = m.source_url.split("/").pop();
						th.onclick = function () { setImg(m.source_url, m.alt_text || alt0.value); };
						grid.appendChild(th);
					});
					if (page < res.tp) {
						var b = h("button", "wed-btn wed-moreimg", "Mehr laden");
						b.onclick = function () { library(page + 1); };
						grid.appendChild(b);
					}
				}).catch(function () { toast("Mediathek konnte nicht geladen werden.", true); });
		}
	}

	document.addEventListener("DOMContentLoaded", function () {
		root = h("div"); root.id = "wisi-ed";
		bar = h("div", "wed-bar"); panel = h("div", "wed-panel"); toastEl = h("div", "wed-toast");
		root.appendChild(bar); root.appendChild(panel); root.appendChild(toastEl);
		document.body.appendChild(root);
		setOn(/[?&]wisi-edit=1/.test(location.search));
	});
})();
