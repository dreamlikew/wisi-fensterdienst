(function () {
	// Texts and photos changed in WordPress (option «wisi_overrides») replace the originals
	// whenever the app puts them on the page, and the header gets the extra links of the
	// WordPress menu «Wisi: zusätzliche Links im Header». Runs for every visitor.
	var W = window.WISI_WP, O = W.overrides || {};
	var OT = O.texts || {}, OI = O.images || {};
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

	// Our own writes come back here too; fixText/fixImg see them as already shown and stop.
	var mo = new MutationObserver(function (list) {
		for (var i = 0; i < list.length; i++) {
			var m = list[i];
			if (m.type === "characterData") fixText(m.target);
			else if (m.type === "attributes") fixImg(m.target);
			else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
		}
		addMenu();
	});
	mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["src", "style"] });
	document.addEventListener("DOMContentLoaded", function () { scan(document.body); addMenu(); });

	// For the editor: original text of a node, and a way to show new values right away.
	window.WISI_LIVE = {
		norm: norm,
		imgId: imgId,
		origOf: function (n) { var r = T.get(n); return r ? r.orig : norm(n.nodeValue); },
		setOverrides: function (o) {
			O = o || {}; OT = O.texts || {}; OI = O.images || {};
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
		}
	};
})();
