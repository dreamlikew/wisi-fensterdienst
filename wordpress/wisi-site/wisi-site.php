<?php
/**
 * Plugin Name: Wisi Fensterdienst – Website
 * Description: Zeigt die neue Wisi-Website (Repo dreamlikew/wisi-fensterdienst) auf allen Seiten mit dem Feld «wisi_route». Andere Seiten bleiben unverändert.
 * Version: 1.0.0
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
 */

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

	$seo  = wisi_site_seo( get_queried_object_id() );
	$cfg  = array( 'route' => $route, 'map' => $map, 'title' => $seo['title'] );
	$boot = '<script>window.WISI_WP=' . wp_json_encode( $cfg ) . ';' . file_get_contents( __DIR__ . '/boot.js' ) . '</script>';

	$html = file_get_contents( $file );
	$html = str_replace(
		array( '%%WISI_APP%%', '%%WISI_UPLOADS%%' ),
		array( plugins_url( 'app/', __FILE__ ), trailingslashit( wp_upload_dir()['baseurl'] ) ),
		$html
	);
	$html = preg_replace( '/<title>.*?<\/title>/s', '', $html, 1 );
	$html = preg_replace( '/<head>/', '<head>' . $boot . $seo['head'], $html, 1 );

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
