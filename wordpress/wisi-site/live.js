(function () {
	// Texts and photos changed in WordPress (option «wisi_overrides») replace the originals
	// whenever the app puts them on the page, and the header gets the extra links of the
	// WordPress menu «Wisi: zusätzliche Links im Header». Runs for every visitor.
	// Also: changed link targets, hidden blocks, the holiday notice and added Merkblätter.
	var W = window.WISI_WP, O = W.overrides || {};
	var OT = O.texts || {}, OI = O.images || {}, OL = O.links || {}, OH = O.hidden || {};
	var SKIP = "script,style,template,noscript,#wisi-ed";

	function norm(s) { return s.replace(/[\s ]+/g, " ").trim(); }
	function imgId(src) { var m = /([0-9a-f]{12})\.(?:jpe?g|webp|png|svg)/.exec(src || ""); return m ? m[1] : null; }

	// Per node: the app's own text (orig) and what is shown now (shown).
	// When the app writes new text into a node, that becomes its new orig.
	var T = new WeakMap();
	function fixText(n) {
		var p = n.parentElement;
		if (!p || p.closest(SKIP)) return;
		var cur = norm(n.nodeValue), r = T.get(n);
		if (!cur && !r) return;
		if (r && cur === r.shown) return;
		r = { orig: cur, shown: cur };
		T.set(n, r);
		var o = OT[cur];
		if (o != null && o !== cur) {
			var v = n.nodeValue, lead = /^[\s ]*/.exec(v)[0], trail = /[\s ]*$/.exec(v)[0];
			r.shown = norm(o);
			n.nodeValue = lead + o + trail;
		}
	}

	// Photos: <img> and inline background images, matched by the 12-character file id.
	function fixImg(el) {
		if (el.closest(SKIP)) return;
		if (el.tagName === "IMG") {
			var src = el.getAttribute("src") || "";
			if (src === el.dataset.wisiShown) return;
			var id = imgId(src);
			el.dataset.wisiOrig = id || "";
			el.dataset.wisiShown = src;
			if (id && OI[id] && OI[id].url) {
				el.dataset.wisiOrigSrc = src;
				el.dataset.wisiOrigAlt = el.getAttribute("alt") || "";
				el.removeAttribute("srcset");
				el.setAttribute("src", OI[id].url);
				el.dataset.wisiShown = OI[id].url;
				if (OI[id].alt) el.setAttribute("alt", OI[id].alt);
			}
			return;
		}
		var bg = el.style && el.style.backgroundImage;
		if (!bg || bg.indexOf("url(") < 0 || bg === el.dataset.wisiShown) return;
		var bid = imgId(bg);
		el.dataset.wisiOrig = bid || "";
		el.dataset.wisiShown = bg;
		if (bid && OI[bid] && OI[bid].url) {
			el.dataset.wisiOrigBg = bg;
			el.style.backgroundImage = bg.replace(/url\((["']?)[^"')]*\1\)/, 'url("' + OI[bid].url + '")');
			el.dataset.wisiShown = el.style.backgroundImage;
		}
	}

	function scan(root) {
		if (root.nodeType === 3) { fixText(root); return; }
		if (root.nodeType !== 1) return;
		if (root.tagName === "IMG" || root.hasAttribute("style")) fixImg(root);
		var tw = document.createTreeWalker(root, 5, null), n;
		while ((n = tw.nextNode())) {
			if (n.nodeType === 3) fixText(n);
			else if (n.tagName === "IMG" || n.hasAttribute("style")) fixImg(n);
		}
	}

	// Extra header links, cloned from «Kontakt» so they look the same (desktop and mobile menu).
	var MENU = W.menu || [];
	function addMenu() {
		if (!MENU.length) return;
		[[".nav-main-menu", ".nav-menu-item"], [".nav-mobile-list-01", ".nav-list-item"]].forEach(function (s) {
			var boxes = document.querySelectorAll(s[0]);
			for (var i = 0; i < boxes.length; i++) {
				var box = boxes[i];
				if (box.querySelector("[data-wisi-menu]")) continue;
				var a = box.querySelector('a[href="#/innerpages/contact-us"]');
				var tpl = a && a.closest(s[1]);
				if (!tpl || tpl.parentElement !== box) continue;
				MENU.forEach(function (m) {
					var c = tpl.cloneNode(true);
					c.setAttribute("data-wisi-menu", "1");
					c.removeAttribute("data-w-id");
					c.style.display = "";
					var l = c.querySelector("a");
					l.className = l.className.replace(/\s*w--current/, "");
					l.removeAttribute("aria-current");
					l.setAttribute("href", m.url);
					l.textContent = m.title;
					if (m.blank) { l.target = "_blank"; l.rel = "noopener"; }
					// Mobile rows have an icon: a neutral "link" icon instead of Kontakt's phone.
					var ic = c.querySelector("svg");
					if (ic) {
						ic.setAttribute("viewBox", "0 0 20 20");
						ic.innerHTML = '<rect x="3" y="3" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 12l4.5-4.5M8.5 7.5h4v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
					}
					box.insertBefore(c, tpl);
				});
				setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 0);
			}
		});
	}

	// ---------- Links: key = original address + original link text ----------
	function origText(el, max) {
		var out = [], tw = document.createTreeWalker(el, 4, null), n;
		while ((n = tw.nextNode())) {
			if (n.parentElement && n.parentElement.closest("script,style")) continue;
			var r = T.get(n), v = r ? r.orig : norm(n.nodeValue);
			// Only words count: animated numbers (counters) would change the key.
			if (/[A-Za-zÀ-ÿ]{2}/.test(v)) out.push(v);
		}
		return out.join(" ").slice(0, max || 200);
	}
	function linkKey(a) {
		var href = a.dataset.wisiHref != null ? a.dataset.wisiHref : (a.getAttribute("href") || "");
		return href + "|" + origText(a);
	}
	function fixLink(a) {
		if (a.closest(SKIP)) return;
		var cur = a.getAttribute("href") || "";
		if (a.dataset.wisiHrefShown != null && cur === a.dataset.wisiHrefShown) return;
		a.dataset.wisiHref = cur;
		delete a.dataset.wisiHrefShown;
		var o = OL[linkKey(a)];
		if (o && o.href) {
			if (!a.hasAttribute("data-wisi-target")) a.setAttribute("data-wisi-target", a.getAttribute("target") || "");
			a.setAttribute("href", o.href);
			a.dataset.wisiHrefShown = o.href;
			a.setAttribute("data-wisi-link", "1");
			if (o.blank) { a.target = "_blank"; a.rel = "noopener"; } else a.removeAttribute("target");
		} else if (a.hasAttribute("data-wisi-link")) {
			a.removeAttribute("data-wisi-link");
			var tg = a.getAttribute("data-wisi-target");
			if (tg) a.target = tg; else a.removeAttribute("target");
		}
	}
	// The app has its own click handlers on some buttons; a changed link must win over them.
	window.addEventListener("click", function (e) {
		if (document.documentElement.classList.contains("wisi-editing")) return;
		var a = e.target.closest && e.target.closest("a[data-wisi-link]");
		if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey) return;
		e.preventDefault(); e.stopImmediatePropagation();
		if (a.target === "_blank") window.open(a.href, "_blank", "noopener"); else location.href = a.href;
	}, true);

	// ---------- Hidden blocks: only sections and cards that can go without breaking the layout ----------
	var SECTION = ".main-wrapper > section:not(.hero-section):not(.service-details-section):not(.project-banner-section):not(.services-banner-section):not(.wwa-sec):not(.contact-section):not(.wpg-sec):not(.wmb-sec)";
	var CARD = ".feature-widget, .stc-card, .w-dyn-item, .stats-single-block, .team-member-card, .faq-list-item, .wmb-card, .contact-info-card, .service-card, .wfq2-i";
	function unitKey(el) { return (el.classList[0] || el.tagName) + "|" + origText(el, 120); }
	// Outermost card around el (a .service-card inside a .w-dyn-item hides the whole grid cell), and its section.
	function unitsOf(el) {
		var card = null, sec = null, x = el;
		while (x && x !== document.body) {
			if (x.matches && x.matches(CARD)) card = x;
			if (x.matches && x.matches(SECTION)) { sec = x; break; }
			x = x.parentElement;
		}
		if (card && card.closest("footer, .footer-section, header, .w-nav")) card = null;
		return { card: card, section: sec };
	}
	var hideCss = document.createElement("style");
	hideCss.textContent = ".wisi-hide{display:none!important}";
	document.head.appendChild(hideCss);
	function fixHidden() {
		var els = document.querySelectorAll(SECTION + "," + CARD);
		for (var i = 0; i < els.length; i++) {
			var e = els[i], h = !!OH[unitKey(e)];
			if (h !== e.classList.contains("wisi-hide")) e.classList.toggle("wisi-hide", h);
		}
	}

	// ---------- Holiday notice above the header ----------
	function fixNotice() {
		var N = W.notice;
		if (!N || !N.text || document.querySelector(".wisi-notice")) return;
		try { if (sessionStorage.getItem("wisiNoticeOff") === N.text) return; } catch (e) {}
		var hd = document.querySelector(".header");
		if (!hd || !hd.parentElement) return;
		var d = document.createElement("div");
		d.className = "wisi-notice";
		d.setAttribute("role", "status");
		d.style.cssText = "position:relative;z-index:1001;padding:10px 52px 10px 16px;background:#009bd2;color:#fff;font-size:15px;line-height:1.4;text-align:center;font-weight:500";
		var s = document.createElement("span");
		s.textContent = N.text;
		var x = document.createElement("button");
		x.type = "button";
		x.setAttribute("aria-label", "Hinweis schliessen");
		x.textContent = "×";
		x.style.cssText = "position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:22px;line-height:1;cursor:pointer";
		x.onclick = function () { d.remove(); try { sessionStorage.setItem("wisiNoticeOff", N.text); } catch (e) {} };
		d.appendChild(s); d.appendChild(x);
		hd.parentElement.insertBefore(d, hd);
	}

	// ---------- Added Merkblätter: copies of the first card ----------
	var DOC = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect width="300" height="420" fill="#eef6fa"/><path d="M95 90h80l40 40v190a10 10 0 0 1-10 10H95a10 10 0 0 1-10-10V100a10 10 0 0 1 10-10z" fill="#fff" stroke="#009bd2" stroke-width="6"/><path d="M175 90v40h40" fill="none" stroke="#009bd2" stroke-width="6"/><path d="M110 180h80M110 210h80M110 240h55" stroke="#9cc9dc" stroke-width="8" stroke-linecap="round"/></svg>');
	function fixMerkblaetter() {
		var M = W.merkblaetter || [];
		if (!M.length) return;
		var g = document.querySelector(".wmb-grid");
		if (!g || g.querySelector("[data-wisi-mb]")) return;
		var tpl = g.querySelector(".wmb-card");
		if (!tpl) return;
		M.forEach(function (m) {
			var c = tpl.cloneNode(true);
			c.setAttribute("data-wisi-mb", "1");
			c.classList.remove("wisi-hide");
			c.setAttribute("href", m.url);
			var tt = c.querySelector(".wmb-t");
			if (tt) tt.textContent = m.title;
			var im = c.querySelector("img");
			if (im) {
				["wisiOrig", "wisiShown", "wisiOrigSrc", "wisiOrigAlt"].forEach(function (k) { delete im.dataset[k]; });
				im.removeAttribute("srcset");
				im.setAttribute("src", m.thumb || DOC);
				im.setAttribute("alt", m.title);
			}
			g.appendChild(c);
		});
	}

	function any(o) { for (var k in o) return true; return false; }
	var queued = false, last = 0;
	function pass() {
		queued = false; last = Date.now();
		if (any(OL) || document.querySelector("a[data-wisi-link]")) {
			var a = document.querySelectorAll("a[href]");
			for (var i = 0; i < a.length; i++) fixLink(a[i]);
		}
		fixNotice();
		fixMerkblaetter();
		if (any(OH) || document.querySelector(".wisi-hide")) fixHidden();
	}
	// At most every 200 ms: animations change texts many times per second.
	function schedule() {
		if (queued) return;
		queued = true;
		setTimeout(function () { (window.requestAnimationFrame || setTimeout)(pass); }, Math.max(0, 200 - (Date.now() - last)));
	}

	// Our own writes come back here too; fixText/fixImg see them as already shown and stop.
	var mo = new MutationObserver(function (list) {
		for (var i = 0; i < list.length; i++) {
			var m = list[i];
			if (m.type === "characterData") fixText(m.target);
			else if (m.type === "attributes") { if (m.attributeName !== "href") fixImg(m.target); }
			else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
		}
		addMenu();
		schedule();
	});
	mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["src", "style", "href"] });
	document.addEventListener("DOMContentLoaded", function () { scan(document.body); addMenu(); pass(); });

	// For the editor: original text of a node, and a way to show new values right away.
	window.WISI_LIVE = {
		norm: norm,
		imgId: imgId,
		origOf: function (n) { var r = T.get(n); return r ? r.orig : norm(n.nodeValue); },
		origText: origText,
		linkKey: linkKey,
		unitKey: unitKey,
		unitsOf: unitsOf,
		setOverrides: function (o) {
			O = o || {}; OT = O.texts || {}; OI = O.images || {}; OL = O.links || {}; OH = O.hidden || {};
			W.overrides = O;
			var tw = document.createTreeWalker(document.body, 5, null), n, all = [];
			while ((n = tw.nextNode())) all.push(n);
			all.forEach(function (x) {
				if (x.nodeType === 3) {
					var r = T.get(x);
					if (r && norm(x.nodeValue) === r.shown && r.shown !== r.orig) {
						var v = x.nodeValue; x.nodeValue = /^[\s ]*/.exec(v)[0] + r.orig + /[\s ]*$/.exec(v)[0];
					}
					T.delete(x);
					fixText(x);
				} else if (x.dataset && x.dataset.wisiShown != null) {
					if (x.dataset.wisiOrigSrc) { x.setAttribute("src", x.dataset.wisiOrigSrc); x.setAttribute("alt", x.dataset.wisiOrigAlt || ""); }
					if (x.dataset.wisiOrigBg) x.style.backgroundImage = x.dataset.wisiOrigBg;
					delete x.dataset.wisiShown; delete x.dataset.wisiOrigSrc; delete x.dataset.wisiOrigBg;
					fixImg(x);
				}
			});
			var as = document.querySelectorAll("a[data-wisi-href-shown]");
			for (var i = 0; i < as.length; i++) {
				as[i].setAttribute("href", as[i].dataset.wisiHref);
				delete as[i].dataset.wisiHrefShown;
			}
			pass();
		}
	};
})();
