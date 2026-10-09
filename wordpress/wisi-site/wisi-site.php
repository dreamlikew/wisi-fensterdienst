<?php
/**
 * Plugin Name: Wisi Fensterdienst – Website
 * Description: Zeigt die neue Wisi-Website (Repo dreamlikew/wisi-fensterdienst) auf allen Seiten mit dem Feld «wisi_route». Andere Seiten bleiben unverändert.
 * Version: 1.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: BALI Flow
 * License: GPL-2.0-or-later
 */

defined( 'ABSPATH' ) || exit;

/*
 * Jede Seite mit dem Feld «wisi_route» (z. B. "/innerpages/contact-us") zeigt
 * app/index.html, die unveränderte Website, und öffnet direkt diese Route.
 * Links zwischen den Seiten führen auf die WordPress-Adressen der jeweiligen Seite.
 *
 * Texte und Fotos ändert man direkt auf der Seite («Seite bearbeiten», nur angemeldet).
 * Die Änderungen liegen in der Option «wisi_overrides», nicht im Plugin: ein Update
 * des Plugins behält sie. Zusätzliche Links im Header: Design → Menüs, Position
 * «Wisi: zusätzliche Links im Header».
 */

define( 'WISI_SITE_HISTORY', 30 );

add_action( 'after_setup_theme', function () {
	register_nav_menus( array( 'wisi_header' => 'Wisi: zusätzliche Links im Header' ) );
} );

function wisi_site_overrides() {
	$o = get_option( 'wisi_overrides' );
	return array(
		'texts'  => ( is_array( $o ) && ! empty( $o['texts'] ) ) ? $o['texts'] : new stdClass(),
		'images' => ( is_array( $o ) && ! empty( $o['images'] ) ) ? $o['images'] : new stdClass(),
	);
}

// Plain text only (the page sets it as text, never as HTML); photos only from this site's media library.
function wisi_site_clean_overrides( $in ) {
	$out = array( 'texts' => array(), 'images' => array() );
	if ( isset( $in['texts'] ) && is_array( $in['texts'] ) ) {
		foreach ( $in['texts'] as $k => $v ) {
			if ( ! is_string( $v ) || strlen( $k ) > 5000 || strlen( $v ) > 5000 ) {
				continue;
			}
			$out['texts'][ wp_check_invalid_utf8( (string) $k ) ] = wp_check_invalid_utf8( str_replace( "\r", '', $v ) );
		}
	}
	$uploads = wp_upload_dir()['baseurl'];
	$uploads = preg_replace( '#^https?:#', '', $uploads );
	if ( isset( $in['images'] ) && is_array( $in['images'] ) ) {
		foreach ( $in['images'] as $id => $img ) {
			if ( ! preg_match( '/^[0-9a-f]{12}$/', (string) $id ) || ! is_array( $img ) || empty( $img['url'] ) ) {
				continue;
			}
			$url = esc_url_raw( $img['url'] );
			if ( 0 !== strpos( preg_replace( '#^https?:#', '', $url ), $uploads ) ) {
				continue;
			}
			$out['images'][ $id ] = array(
				'url' => $url,
				'alt' => sanitize_text_field( isset( $img['alt'] ) ? $img['alt'] : '' ),
			);
		}
	}
	return $out;
}

add_action( 'rest_api_init', function () {
	$can = function () {
		return current_user_can( 'edit_pages' );
	};
	register_rest_route( 'wisi/v1', '/overrides', array(
		'methods'             => 'POST',
		'permission_callback' => $can,
		'callback'            => function ( WP_REST_Request $req ) {
			$new  = wisi_site_clean_overrides( $req->get_json_params() );
			$old  = get_option( 'wisi_overrides', array( 'texts' => array(), 'images' => array() ) );
			$hist = get_option( 'wisi_overrides_history', array() );
			if ( $old !== $new ) {
				$hist[] = array( 'time' => time(), 'user' => get_current_user_id(), 'data' => $old );
				$hist   = array_slice( $hist, -WISI_SITE_HISTORY );
				update_option( 'wisi_overrides_history', $hist, false );
				update_option( 'wisi_overrides', $new, false );
			}
			return array( 'overrides' => wisi_site_overrides() );
		},
	) );
	register_rest_route( 'wisi/v1', '/undo', array(
		'methods'             => 'POST',
		'permission_callback' => $can,
		'callback'            => function () {
			$hist = get_option( 'wisi_overrides_history', array() );
			$last = array_pop( $hist );
			if ( $last ) {
				update_option( 'wisi_overrides', $last['data'], false );
				update_option( 'wisi_overrides_history', $hist, false );
			}
			return array( 'overrides' => wisi_site_overrides(), 'undone' => (bool) $last );
		},
	) );
} );

// In WordPress: «Auf der Seite bearbeiten» in the page list and a hint in the page editor.
add_filter( 'page_row_actions', function ( $actions, $post ) {
	if ( get_post_meta( $post->ID, 'wisi_route', true ) ) {
		$actions = array( 'wisi_edit' => '<a href="' . esc_url( add_query_arg( 'wisi-edit', '1', get_permalink( $post ) ) ) . '"><strong>Texte und Fotos bearbeiten</strong></a>' ) + $actions;
	}
	return $actions;
}, 10, 2 );

add_action( 'admin_notices', function () {
	$screen = get_current_screen();
	if ( ! $screen || 'page' !== $screen->id || empty( $_GET['post'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		return;
	}
	$id = (int) $_GET['post']; // phpcs:ignore WordPress.Security.NonceVerification
	if ( ! get_post_meta( $id, 'wisi_route', true ) ) {
		return;
	}
	echo '<div class="notice notice-info"><p><strong>Diese Seite zeigt die Wisi-Website.</strong> Texte und Fotos ändern Sie direkt auf der Seite: '
		. '<a class="button button-primary" href="' . esc_url( add_query_arg( 'wisi-edit', '1', get_permalink( $id ) ) ) . '">Texte und Fotos bearbeiten</a></p>'
		. '<p>Hier im Editor nur Titel, Adresse (Permalink), Veröffentlichung und Yoast SEO ändern; der Inhalt unten wird nicht angezeigt.</p></div>';
} );

add_action( 'init', function () {
	// wisi_seo_title / wisi_seo_desc: SEO-Titel und -Beschreibung (Deutsch). Yoast-Werte gehen vor, falls gesetzt.
	foreach ( array( 'wisi_route', 'wisi_seo_title', 'wisi_seo_desc' ) as $key ) {
		register_post_meta( 'page', $key, array(
			'type'          => 'string',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function () {
				return current_user_can( 'edit_pages' );
			},
		) );
	}
} );

add_filter( 'template_include', function ( $template ) {
	if ( ! is_page() ) {
		return $template;
	}
	$route = get_post_meta( get_queried_object_id(), 'wisi_route', true );
	if ( ! $route ) {
		return $template;
	}
	wisi_site_render( $route );
	exit;
}, 99 );

function wisi_site_render( $route ) {
	$file = __DIR__ . '/app/index.html';
	if ( ! is_readable( $file ) ) {
		wp_die( 'Wisi: app/index.html fehlt.' );
	}

	$map   = array();
	$pages = get_posts( array(
		'post_type'   => 'page',
		'post_status' => array( 'publish', 'draft', 'pending', 'private', 'future' ),
		'numberposts' => -1,
		'meta_key'    => 'wisi_route',
	) );
	foreach ( $pages as $p ) {
		$r = get_post_meta( $p->ID, 'wisi_route', true );
		// Entwürfe sehen nur angemeldete Bearbeiter; für Besucher nur veröffentlichte Seiten verlinken.
		if ( $r && ( 'publish' === $p->post_status || current_user_can( 'edit_post', $p->ID ) ) ) {
			$map[ $r ] = get_permalink( $p );
		}
	}

	$menu = array();
	$locs = get_nav_menu_locations();
	if ( ! empty( $locs['wisi_header'] ) ) {
		foreach ( (array) wp_get_nav_menu_items( $locs['wisi_header'] ) as $item ) {
			if ( $item && ! $item->menu_item_parent && ( 'publish' === $item->post_status ) ) {
				$menu[] = array( 'title' => wp_strip_all_tags( $item->title ), 'url' => esc_url_raw( $item->url ), 'blank' => '_blank' === $item->target );
			}
		}
	}

	$seo  = wisi_site_seo( get_queried_object_id() );
	$cfg  = array( 'route' => $route, 'map' => $map, 'title' => $seo['title'], 'overrides' => wisi_site_overrides(), 'menu' => $menu );
	$js   = file_get_contents( __DIR__ . '/boot.js' ) . file_get_contents( __DIR__ . '/live.js' );
	$edit = '';
	if ( current_user_can( 'edit_pages' ) ) {
		$cfg['edit'] = array(
			'rest'  => esc_url_raw( rest_url( 'wisi/v1/' ) ),
			'media' => esc_url_raw( rest_url( 'wp/v2/media' ) ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
			'admin' => esc_url_raw( admin_url( 'edit.php?post_type=page' ) ),
		);
		$js  .= file_get_contents( __DIR__ . '/editor.js' );
		$edit = '<style>' . file_get_contents( __DIR__ . '/editor.css' ) . '</style>';
	}
	// wp_json_encode escapes "/", so no text can close the <script> early.
	$boot = '<script>window.WISI_WP=' . wp_json_encode( $cfg ) . ';' . $js . '</script>' . $edit;

	$html = file_get_contents( $file );
	$html = str_replace(
		array( '%%WISI_APP%%', '%%WISI_UPLOADS%%' ),
		array( plugins_url( 'app/', __FILE__ ), trailingslashit( wp_upload_dir()['baseurl'] ) ),
		$html
	);
	$html = preg_replace( '/<title>.*?<\/title>/s', '', $html, 1 );
	// Literal insert: preg_replace would treat "$1" in edited texts as a back-reference.
	$at   = strpos( $html, '<head>' ) + strlen( '<head>' );
	$html = substr( $html, 0, $at ) . $boot . $seo['head'] . substr( $html, $at );

	status_header( 200 );
	header( 'Content-Type: text/html; charset=utf-8' );
	if ( 'publish' !== get_post_status() ) {
		header( 'X-Robots-Tag: noindex, nofollow' );
	}
	echo $html; // phpcs:ignore WordPress.Security.EscapeOutput -- eigene, statische Datei
}

function wisi_site_seo( $id ) {
	$yoast_title = get_post_meta( $id, '_yoast_wpseo_title', true );
	$yoast_desc  = get_post_meta( $id, '_yoast_wpseo_metadesc', true );
	$title = ( $yoast_title && false === strpos( $yoast_title, '%%' ) ) ? $yoast_title : get_post_meta( $id, 'wisi_seo_title', true );
	$desc  = ( $yoast_desc && false === strpos( $yoast_desc, '%%' ) ) ? $yoast_desc : get_post_meta( $id, 'wisi_seo_desc', true );
	if ( ! $title ) {
		$title = get_the_title( $id ) . ' | Wisi Fensterdienst';
	}
	$url   = get_permalink( $id );
	$image = plugins_url( 'app/og.jpg', __FILE__ );
	$site  = home_url( '/' );

	$business = array(
		'@context'   => 'https://schema.org',
		'@type'      => 'HomeAndConstructionBusiness',
		'@id'        => $site . '#business',
		'name'       => 'Wisi Fensterdienst GmbH',
		'url'        => $site,
		'image'      => $image,
		'logo'       => plugins_url( 'app/img/c1d15abd0d86.svg', __FILE__ ),
		'telephone'  => '+41767018840',
		'email'      => 'info@fensterdienst.ch',
		'address'    => array(
			'@type'           => 'PostalAddress',
			'streetAddress'   => 'Albegg 2',
			'postalCode'      => '8840',
			'addressLocality' => 'Einsiedeln',
			'addressRegion'   => 'SZ',
			'addressCountry'  => 'CH',
		),
		'areaServed' => array( 'Einsiedeln', 'Höfe', 'Wädenswil', 'Richterswil', 'Horgen', 'Ägeri', 'Menzingen', 'Unteriberg', 'Thalwil', 'Rapperswil-Jona' ),
		'founder'    => array( '@type' => 'Person', 'name' => 'Martin Röllin' ),
	);
	$page = array(
		'@context'    => 'https://schema.org',
		'@type'       => 'WebPage',
		'url'         => $url,
		'name'        => $title,
		'description' => $desc,
		'inLanguage'  => 'de-CH',
		'about'       => array( '@id' => $site . '#business' ),
	);

	$e    = 'esc_attr';
	$head = '<title>' . esc_html( $title ) . '</title>'
		. ( $desc ? '<meta name="description" content="' . $e( $desc ) . '">' : '' )
		. '<link rel="canonical" href="' . esc_url( $url ) . '">'
		. '<meta property="og:type" content="website">'
		. '<meta property="og:locale" content="de_CH">'
		. '<meta property="og:site_name" content="Wisi Fensterdienst">'
		. '<meta property="og:title" content="' . $e( $title ) . '">'
		. ( $desc ? '<meta property="og:description" content="' . $e( $desc ) . '">' : '' )
		. '<meta property="og:url" content="' . esc_url( $url ) . '">'
		. '<meta property="og:image" content="' . esc_url( $image ) . '">'
		. '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
		. '<meta name="twitter:card" content="summary_large_image">'
		. '<meta name="theme-color" content="#009bd2">'
		. '<link rel="icon" href="' . esc_url( get_site_icon_url( 512 ) ?: plugins_url( 'app/img/c1d15abd0d86.svg', __FILE__ ) ) . '">'
		. '<script type="application/ld+json">' . wp_json_encode( ( $id === (int) get_option( 'page_on_front' ) || '/' === get_post_meta( $id, 'wisi_route', true ) ) ? array( $business, $page ) : $page, JSON_UNESCAPED_UNICODE ) . '</script>';
	return array( 'title' => $title, 'head' => $head );
}
