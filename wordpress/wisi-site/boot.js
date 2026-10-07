(function () {
	var W = window.WISI_WP;
	function routeOf(h) { return (h || "").slice(1).split("#")[0]; }
	function subOf(h) { var p = (h || "").slice(1).split("#"); return p.length > 1 ? "#" + p.slice(1).join("#") : ""; }

	// Without a "#/..." hash, open this page's route (an anchor like "#form" is kept as a sub-hash).
	var h = location.hash;
	if (!h || h.charAt(1) !== "/") {
		history.replaceState(null, "", location.pathname + location.search + "#" + W.route + (h ? "#" + h.slice(1) : ""));
	}

	// Internal tools (Debug panel, edit mode, Super Editar) stay off on the public site:
	// clear their saved state and stop the right-click on the logo that opens the panel.
	try { ["wisiDbgOn", "wisiEdit", "wisiDbgPos", "wisiDbgMin"].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
	window.addEventListener("contextmenu", function (e) {
		if (e.target.closest && e.target.closest(".nav-brand, #wisi-dbg")) e.stopImmediatePropagation();
	}, true);
	var off = document.createElement("style");
	off.textContent = "#wisi-dbg,#wse,#wse-rs,#wse-g,#wfs,.wisi-pip{display:none!important}";
	document.head.appendChild(off);

	// Every page gets one <h1>: pages whose title is an <h2> get an invisible <h1> wrapper
	// (display:contents, inherits everything), so the look stays the same.
	function ensureH1() {
		var all = document.querySelectorAll("h1");
		for (var i = 0; i < all.length; i++) if (all[i].offsetParent || all[i].style.display === "contents") return;
		var c = document.querySelectorAll(".main-wrapper h2.h2-style, .main-wrapper h2.content-titile, .main-wrapper h2");
		for (var j = 0; j < c.length; j++) {
			if (!c[j].offsetParent || c[j].closest("header, nav, footer, .w-nav, .footer-section")) continue;
			var w = document.createElement("h1");
			w.style.cssText = "all:inherit;display:contents";
			c[j].parentNode.insertBefore(w, c[j]);
			w.appendChild(c[j]);
			return;
		}
	}
	window.addEventListener("load", function () { setTimeout(ensureH1, 300); });
	window.addEventListener("hashchange", function () { setTimeout(ensureH1, 300); });

	// The app resets document.title on render; on this page's route in German keep the SEO title.
	function lang() { try { return localStorage.getItem("wisiLang") || "de"; } catch (e) { return "de"; } }
	function keepTitle() {
		if (W.title && routeOf(location.hash) === W.route && lang() === "de" && document.title !== W.title) document.title = W.title;
	}
	document.addEventListener("DOMContentLoaded", function () {
		var t = document.querySelector("title");
		if (t) new MutationObserver(keepTitle).observe(t, { childList: true, characterData: true, subtree: true });
		new MutationObserver(function (m) {
			for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].addedNodes.length; j++) if (m[i].addedNodes[j].nodeName === "TITLE") { keepTitle(); return; }
		}).observe(document.head, { childList: true });
		keepTitle();
	});

	// Registered before the app's own listener: a route that has its own WordPress page loads that page.
	window.addEventListener("hashchange", function (e) {
		var nh = location.hash;
		if (nh.charAt(1) !== "/") return;
		var r = routeOf(nh);
		if (r !== W.route && W.map[r]) {
			e.stopImmediatePropagation();
			var u = W.map[r], s = subOf(nh);
			location.replace(s ? u.split("#")[0] + s : u);
		}
	});
})();
