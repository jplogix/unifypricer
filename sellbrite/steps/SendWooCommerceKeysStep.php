<?php

class Sellbrite_SendWooCommerceKeysStep implements Sellbrite_AutomationStep
{
	public function getName()
	{
		return __('Send WooCommerce API keys to Sellbrite', 'sellbrite');
	}

	public function runStep()
	{
		$consumerKey    = get_option('woocommerce_sellbrite_consumer_key');
		$consumerSecret = get_option('woocommerce_sellbrite_consumer_secret');

		if (empty($consumerKey) || empty($consumerSecret)) {
			return new Sellbrite_StepResult(false, 'Could not find WooCommerce API key. Please try again.');
		}

		return new Sellbrite_StepResult(true, 'Redirecting to Sellbrite...', ['consumer_key' => $consumerKey, 'consumer_secret' => $consumerSecret, 'url' => $this->getRedirectUrl($consumerKey, $consumerSecret)]);
	}

	function getRedirectUrl( $consumerKey, $consumerSecret ) {

		$siteUrl = parse_url( site_url() );
		$url     = 'https://app.sellbrite.com/merchants/auth/woocommerce?consumer_key=' . $consumerKey;
		$url     .= '&consumer_secret=' . $consumerSecret;
		$url     .= '&nickname=WooCommerce&provider=woocommerce';
		$url     .= '&site_url=' . urlencode( site_url() );
		$url     .= '&woo_site_protocol=' . urlencode( ! empty( $siteUrl['scheme'] ) ? $siteUrl['scheme'] . '://' : '' );
		$url     .= '&woo_site_url=' . urlencode( $siteUrl['host'] . ( ! empty( $siteUrl['path'] ) ? $siteUrl['path'] : '' ) );

		return $url;
	}
}
