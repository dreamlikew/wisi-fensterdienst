<?php
/**
 * «Wisi Website» im WordPress-Menü: Kontaktdaten, Ferien-Hinweis, Merkblätter,
 * ausgeblendete Elemente und geänderte Links.
 */

defined( 'ABSPATH' ) || exit;

// The values the website was built with; the page is only rewritten where a setting differs.
define( 'WISI_SITE_DEFAULTS', array(
	'phone'        => '076 701 88 40',
	'whatsapp'     => '',
	'email'        => 'info@fensterdienst.ch',
	'street'       => 'Albegg 2',
	'plz'          => '8840',
	'ort'          => 'Einsiedeln',
	'notice_on'    => 0,
	'notice_text'  => 'Betriebsferien vom {von} bis {bis}. Ab dem {zurueck} sind wir wieder für Sie da.',
	'notice_from'  => '',
	'notice_to'    => '',
	'notice_days'  => 14,
	'merkblaetter' => array(),
) );

function wisi_site_settings() {
	$s = get_option( 'wisi_settings' );
	return array_merge( WISI_SITE_DEFAULTS, is_array( $s ) ? $s : array() );
}

// "076 701 88 40" -> "41767018840" (Swiss numbers; +41 / 0041 / 41 also accepted).
function wisi_site_intl( $phone ) {
	$d = preg_replace( '/\D+/', '', (string) $phone );
	if ( 0 === strpos( $d, '00' ) ) {
		$d = substr( $d, 2 );
	} elseif ( 0 === strpos( $d, '0' ) ) {
		$d = '41' . substr( $d, 1 );
	}
	return $d;
}

/*
 * Replaces the contact data everywhere in the page: visible texts, tel:/mailto:/wa.me links,
 * map links and the translations. Not touched: the zone map, the postcode list and the
 * example place in the form (they also contain "8840 Einsiedeln" but mean the area, not the workshop).
 */
function wisi_site_apply_contact( $html ) {
	$s = wisi_site_settings();
	$d = WISI_SITE_DEFAULTS;

	if ( $s['phone'] !== $d['phone'] ) {
		$html = str_replace( array( '076 701 88 40', '+41767018840' ), array( esc_html( $s['phone'] ), '+' . wisi_site_intl( $s['phone'] ) ), $html );
	}
	$wa = wisi_site_intl( $s['whatsapp'] ? $s['whatsapp'] : $s['phone'] );
	if ( '41767018840' !== $wa ) {
		$html = preg_replace( '/(?<!\+)41767018840/', $wa, $html );
	}
	if ( $s['email'] !== $d['email'] ) {
		$html = str_replace( 'info@fensterdienst.ch', $s['email'], $html );
	}
	if ( $s['street'] !== $d['street'] || $s['plz'] !== $d['plz'] || $s['ort'] !== $d['ort'] ) {
		$street = esc_html( $s['street'] );
		$plzort = esc_html( $s['plz'] . ' ' . $s['ort'] );
		$html   = str_replace( '["Albegg 2", "Albegg 2", "Albegg 2"]', wp_json_encode( array( $s['street'], $s['street'], $s['street'] ), JSON_UNESCAPED_UNICODE ), $html );
		$html   = str_replace( '["8840 Einsiedeln", "8840 Einsiedeln", "8840 Einsiedeln"]', wp_json_encode( array_fill( 0, 3, $s['plz'] . ' ' . $s['ort'] ), JSON_UNESCAPED_UNICODE ), $html );
		$sep    = '(?:\s|\+|%20|&nbsp;|\x{00a0})*';
		$html   = preg_replace_callback(
			'/Albegg(' . $sep . ')2((?:(?!Albegg).){0,160}?)8840(' . $sep . ')Einsiedeln/su',
			function ( $m ) use ( $s, $street ) {
				// Same encoding as the original: "+" or "%20" inside URLs, plain text elsewhere.
				$enc = function ( $v, $glue ) {
					if ( false !== strpos( $glue, '%20' ) ) {
						return rawurlencode( $v );
					}
					if ( false !== strpos( $glue, '+' ) ) {
						return urlencode( $v );
					}
					return esc_html( $v );
				};
				$g1 = $m[1] ? $m[1] : $m[3];
				return $enc( $s['street'], $g1 . $m[2] ) . $m[2] . $enc( $s['plz'], $m[3] ) . $m[3] . $enc( $s['ort'], $m[3] );
			},
			$html
		);
		$html = str_replace( array( 'Albegg 2', 'Albegg+2' ), array( $street, urlencode( $s['street'] ) ), $html );
	}
	return $html;
}

// The holiday notice text when it should show today, else ''.
function wisi_site_notice() {
	$s = wisi_site_settings();
	if ( empty( $s['notice_on'] ) || ! $s['notice_from'] || ! $s['notice_to'] ) {
		return '';
	}
	$tz    = wp_timezone();
	$today = new DateTimeImmutable( 'today', $tz );
	$from  = DateTimeImmutable::createFromFormat( '!Y-m-d', $s['notice_from'], $tz );
	$to    = DateTimeImmutable::createFromFormat( '!Y-m-d', $s['notice_to'], $tz );
	if ( ! $from || ! $to || $today > $to || $today < $from->modify( '-' . (int) $s['notice_days'] . ' days' ) ) {
		return '';
	}
	return strtr( $s['notice_text'], array(
		'{von}'     => $from->format( 'j.n.Y' ),
		'{bis}'     => $to->format( 'j.n.Y' ),
		'{zurueck}' => $to->modify( '+1 day' )->format( 'j.n.Y' ),
	) );
}

function wisi_site_merkblaetter() {
	$out = array();
	foreach ( (array) wisi_site_settings()['merkblaetter'] as $m ) {
		$url = ! empty( $m['pdf'] ) ? wp_get_attachment_url( (int) $m['pdf'] ) : '';
		if ( ! $url || empty( $m['title'] ) ) {
			continue;
		}
		$thumb = ! empty( $m['thumb'] ) ? wp_get_attachment_image_url( (int) $m['thumb'], 'medium_large' ) : '';
		if ( ! $thumb ) {
			$thumb = wp_get_attachment_image_url( (int) $m['pdf'], 'medium' ); // PDF preview, if the server made one
		}
		$out[] = array( 'title' => $m['title'], 'url' => $url, 'thumb' => $thumb ? $thumb : '' );
	}
	return $out;
}

// ---------- Admin page ----------

add_action( 'admin_menu', function () {
	add_menu_page( 'Wisi Website', 'Wisi Website', 'edit_pages', 'wisi-website', 'wisi_site_admin_page', 'dashicons-admin-site-alt3', 3 );
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( 'toplevel_page_wisi-website' === $hook ) {
		wp_enqueue_media();
	}
} );

add_action( 'admin_post_wisi_save_settings', function () {
	if ( ! current_user_can( 'edit_pages' ) ) {
		wp_die( 'Keine Berechtigung.' );
	}
	check_admin_referer( 'wisi_settings' );
	$in = wp_unslash( $_POST );
	$s  = wisi_site_settings();

	foreach ( array( 'phone', 'whatsapp', 'street', 'plz', 'ort', 'notice_text' ) as $k ) {
		$s[ $k ] = isset( $in[ $k ] ) ? sanitize_text_field( $in[ $k ] ) : '';
	}
	$s['email']       = isset( $in['email'] ) && is_email( $in['email'] ) ? sanitize_email( $in['email'] ) : $s['email'];
	$s['notice_on']   = empty( $in['notice_on'] ) ? 0 : 1;
	$s['notice_days'] = isset( $in['notice_days'] ) ? max( 0, min( 90, (int) $in['notice_days'] ) ) : 14;
	foreach ( array( 'notice_from', 'notice_to' ) as $k ) {
		$s[ $k ] = isset( $in[ $k ] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $in[ $k ] ) ? $in[ $k ] : '';
	}
	foreach ( array( 'phone', 'street', 'plz', 'ort' ) as $k ) {
		if ( '' === $s[ $k ] ) {
			$s[ $k ] = WISI_SITE_DEFAULTS[ $k ];
		}
	}
	if ( '' === $s['notice_text'] ) {
		$s['notice_text'] = WISI_SITE_DEFAULTS['notice_text'];
	}

	$mb = array();
	if ( ! empty( $in['mb'] ) && is_array( $in['mb'] ) ) {
		foreach ( $in['mb'] as $m ) {
			$title = isset( $m['title'] ) ? sanitize_text_field( $m['title'] ) : '';
			$pdf   = isset( $m['pdf'] ) ? (int) $m['pdf'] : 0;
			if ( $title && $pdf && 'application/pdf' === get_post_mime_type( $pdf ) ) {
				$mb[] = array( 'title' => $title, 'pdf' => $pdf, 'thumb' => isset( $m['thumb'] ) ? (int) $m['thumb'] : 0 );
			}
		}
	}
	$s['merkblaetter'] = $mb;
	update_option( 'wisi_settings', $s, false );

	// "Wieder anzeigen" / "Original-Link" ticks: remove those entries from the page changes (kept in the history).
	$show  = isset( $in['show'] ) ? (array) $in['show'] : array();
	$reset = isset( $in['resetlink'] ) ? (array) $in['resetlink'] : array();
	if ( $show || $reset ) {
		$o   = get_option( 'wisi_overrides', array() );
		$old = $o;
		foreach ( $show as $k ) {
			unset( $o['hidden'][ $k ] );
		}
		foreach ( $reset as $k ) {
			unset( $o['links'][ $k ] );
		}
		if ( $o !== $old ) {
			$hist   = get_option( 'wisi_overrides_history', array() );
			$hist[] = array( 'time' => time(), 'user' => get_current_user_id(), 'data' => $old );
			update_option( 'wisi_overrides_history', array_slice( $hist, -WISI_SITE_HISTORY ), false );
			update_option( 'wisi_overrides', $o, false );
		}
	}
	wp_safe_redirect( add_query_arg( 'saved', '1', admin_url( 'admin.php?page=wisi-website' ) ) );
	exit;
} );

function wisi_site_admin_page() {
	$s     = wisi_site_settings();
	$o     = get_option( 'wisi_overrides', array() );
	$front = get_option( 'page_on_front' );
	$home  = $front && get_post_meta( $front, 'wisi_route', true ) ? get_permalink( $front ) : '';
	if ( ! $home ) {
		$p    = get_posts( array( 'post_type' => 'page', 'post_status' => array( 'publish', 'draft' ), 'meta_key' => 'wisi_route', 'meta_value' => '/', 'numberposts' => 1 ) );
		$home = $p ? get_permalink( $p[0] ) : home_url( '/' );
	}
	$f = function ( $k ) use ( $s ) {
		return esc_attr( $s[ $k ] );
	};
	?>
	<div class="wrap wisi-admin">
		<h1>Wisi Website</h1>
		<?php if ( ! empty( $_GET['saved'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-success is-dismissible"><p>Gespeichert. Die Änderungen sind sofort auf der Website sichtbar.</p></div>
		<?php endif; ?>
		<p>Texte und Fotos ändern Sie direkt auf der Seite:
			<a class="button button-primary" href="<?php echo esc_url( add_query_arg( 'wisi-edit', '1', $home ) ); ?>">Texte und Fotos bearbeiten</a></p>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="wisi_save_settings">
			<?php wp_nonce_field( 'wisi_settings' ); ?>

			<h2>Kontaktdaten</h2>
			<p class="description">Gilt für die ganze Website: Texte, Anruf-Knöpfe, WhatsApp, E-Mail-Links, Karte und das Formular.</p>
			<table class="form-table" role="presentation">
				<tr><th><label for="phone">Telefon</label></th><td><input class="regular-text" id="phone" name="phone" value="<?php echo $f( 'phone' ); ?>"><p class="description">So wie er auf der Website stehen soll, z. B. 076 701 88 40.</p></td></tr>
				<tr><th><label for="whatsapp">WhatsApp-Nummer</label></th><td><input class="regular-text" id="whatsapp" name="whatsapp" value="<?php echo $f( 'whatsapp' ); ?>" placeholder="leer = gleiche Nummer wie Telefon"><p class="description">Hierhin gehen die Nachrichten aus dem Formular.</p></td></tr>
				<tr><th><label for="email">E-Mail</label></th><td><input class="regular-text" type="email" id="email" name="email" value="<?php echo $f( 'email' ); ?>"></td></tr>
				<tr><th><label for="street">Adresse der Werkstatt</label></th><td>
					<input class="regular-text" id="street" name="street" value="<?php echo $f( 'street' ); ?>"><br>
					<input style="width:6em" id="plz" name="plz" value="<?php echo $f( 'plz' ); ?>" aria-label="PLZ">
					<input class="regular-text" style="width:18em" id="ort" name="ort" value="<?php echo $f( 'ort' ); ?>" aria-label="Ort">
					<p class="description">Die Karte mit den Einsatzgebieten bleibt gleich. Sätze wie «am Albegg in Einsiedeln» bitte auf der Seite selbst anpassen.</p></td></tr>
			</table>

			<h2>Ferien-Hinweis</h2>
			<p class="description">Ein blauer Streifen ganz oben auf jeder Seite. Er erscheint automatisch einige Tage vorher und verschwindet nach dem letzten Ferientag.</p>
			<table class="form-table" role="presentation">
				<tr><th>Anzeigen</th><td><label><input type="checkbox" name="notice_on" value="1" <?php checked( $s['notice_on'] ); ?>> Ferien-Hinweis einschalten</label></td></tr>
				<tr><th><label for="notice_from">Ferien</label></th><td>vom <input type="date" id="notice_from" name="notice_from" value="<?php echo $f( 'notice_from' ); ?>"> bis <input type="date" id="notice_to" name="notice_to" value="<?php echo $f( 'notice_to' ); ?>"></td></tr>
				<tr><th><label for="notice_days">Ab wann zeigen</label></th><td><input type="number" min="0" max="90" style="width:5em" id="notice_days" name="notice_days" value="<?php echo $f( 'notice_days' ); ?>"> Tage vor Ferienbeginn</td></tr>
				<tr><th><label for="notice_text">Text</label></th><td><input class="large-text" id="notice_text" name="notice_text" value="<?php echo $f( 'notice_text' ); ?>"><p class="description">{von}, {bis} und {zurueck} werden durch die Daten ersetzt.</p>
					<?php $n = wisi_site_notice(); ?>
					<p><?php echo $n ? 'Heute sichtbar: <strong>' . esc_html( $n ) . '</strong>' : 'Heute nicht sichtbar.'; ?></p></td></tr>
			</table>

			<h2>Merkblätter</h2>
			<p class="description">Zusätzliche Merkblätter erscheinen auf der Seite «Merkblätter» nach den bestehenden. Bestehende können Sie auf der Seite selbst ausblenden.</p>
			<table class="widefat striped" id="wisi-mb" style="max-width:900px">
				<thead><tr><th>Titel</th><th>PDF</th><th>Vorschaubild (optional)</th><th></th></tr></thead>
				<tbody>
				<?php foreach ( array_merge( (array) $s['merkblaetter'], array( array( 'title' => '', 'pdf' => 0, 'thumb' => 0 ) ) ) as $i => $m ) : ?>
					<tr>
						<td><input class="regular-text" name="mb[<?php echo (int) $i; ?>][title]" value="<?php echo esc_attr( $m['title'] ); ?>" placeholder="Titel des neuen Merkblatts"></td>
						<td><input type="hidden" name="mb[<?php echo (int) $i; ?>][pdf]" value="<?php echo (int) $m['pdf']; ?>">
							<button type="button" class="button wisi-pick" data-type="application/pdf">PDF wählen</button>
							<span class="wisi-name"><?php echo $m['pdf'] ? esc_html( basename( (string) get_attached_file( (int) $m['pdf'] ) ) ) : ''; ?></span></td>
						<td><input type="hidden" name="mb[<?php echo (int) $i; ?>][thumb]" value="<?php echo (int) $m['thumb']; ?>">
							<button type="button" class="button wisi-pick" data-type="image">Bild wählen</button>
							<span class="wisi-name"><?php echo $m['thumb'] ? esc_html( basename( (string) get_attached_file( (int) $m['thumb'] ) ) ) : ''; ?></span></td>
						<td><?php if ( $m['title'] ) : ?><button type="button" class="button-link-delete wisi-del">Entfernen</button><?php endif; ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<p><button type="button" class="button" id="wisi-mb-add">+ Weiteres Merkblatt</button></p>

			<?php if ( ! empty( $o['hidden'] ) ) : ?>
				<h2>Ausgeblendete Elemente</h2>
				<p class="description">Häkchen setzen und speichern, um ein Element wieder anzuzeigen.</p>
				<ul>
				<?php foreach ( $o['hidden'] as $k => $label ) : ?>
					<li><label><input type="checkbox" name="show[]" value="<?php echo esc_attr( $k ); ?>"> Wieder anzeigen: <strong><?php echo esc_html( $label ? $label : $k ); ?></strong></label></li>
				<?php endforeach; ?>
				</ul>
			<?php endif; ?>

			<?php if ( ! empty( $o['links'] ) ) : ?>
				<h2>Geänderte Links</h2>
				<ul>
				<?php foreach ( $o['links'] as $k => $l ) : $parts = explode( '|', $k, 2 ); ?>
					<li><label><input type="checkbox" name="resetlink[]" value="<?php echo esc_attr( $k ); ?>"> Original wiederherstellen:
						<strong><?php echo esc_html( isset( $parts[1] ) && $parts[1] ? $parts[1] : $parts[0] ); ?></strong> → <?php echo esc_html( $l['href'] ); ?></label></li>
				<?php endforeach; ?>
				</ul>
			<?php endif; ?>

			<?php submit_button( 'Speichern' ); ?>
		</form>
	</div>
	<script>
	(function () {
		var tb = document.querySelector('#wisi-mb tbody');
		function rows() { return tb.querySelectorAll('tr'); }
		document.getElementById('wisi-mb-add').onclick = function () {
			var last = rows()[rows().length - 1], c = last.cloneNode(true), n = rows().length;
			c.querySelectorAll('input').forEach(function (i) { i.name = i.name.replace(/mb\[\d+\]/, 'mb[' + n + ']'); i.value = i.type === 'hidden' ? '0' : ''; });
			c.querySelectorAll('.wisi-name').forEach(function (s) { s.textContent = ''; });
			tb.appendChild(c);
		};
		tb.addEventListener('click', function (e) {
			var del = e.target.closest('.wisi-del');
			if (del) { var tr = del.closest('tr'); tr.querySelectorAll('input').forEach(function (i) { i.value = i.type === 'hidden' ? '0' : ''; }); tr.style.display = 'none'; return; }
			var b = e.target.closest('.wisi-pick');
			if (!b) return;
			var td = b.closest('td'), frame = wp.media({ title: b.textContent, library: { type: b.dataset.type }, multiple: false });
			frame.on('select', function () {
				var a = frame.state().get('selection').first().toJSON();
				td.querySelector('input').value = a.id;
				td.querySelector('.wisi-name').textContent = a.filename;
			});
			frame.open();
		});
	})();
	</script>
	<?php
}
