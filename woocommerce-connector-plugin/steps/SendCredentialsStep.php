<?php

class Price_Sync_SendCredentialsStep implements Price_Sync_Step
{
	public function getName()
	{
		return __('Securely send credentials to Price Sync Dashboard', 'price-sync-connector');
	}

	public function runStep($token)
	{
		$consumerKey = get_option('price_sync_consumer_key');
		$consumerSecret = get_option('price_sync_consumer_secret');

		if (empty($consumerKey) || empty($consumerSecret)) {
			return new Price_Sync_StepResult(
				false,
				__('API keys not found. Please try the connection process again.', 'price-sync-connector')
			);
		}

		// Get backend URL from token or use default
		$backendUrl = defined('PRICE_SYNC_BACKEND_URL') ? PRICE_SYNC_BACKEND_URL : 'http://localhost:3000/api';

		// Prepare payload
		$payload = [
			'token' => $token,
			'consumer_key' => $consumerKey,
			'consumer_secret' => $consumerSecret,
			'site_url' => home_url(),
			'store_name' => get_bloginfo('name'),
			'platform' => 'woocommerce',
		];

		// Send via POST (more secure than URL params)
		$response = wp_remote_post($backendUrl . '/connect/woocommerce', [
			'method' => 'POST',
			'headers' => [
				'Content-Type' => 'application/json',
			],
			'body' => json_encode($payload),
			'timeout' => 30,
		]);

		// Check for errors
		if (is_wp_error($response)) {
			return new Price_Sync_StepResult(
				false,
				__('Could not connect to Price Sync Dashboard: ', 'price-sync-connector') . $response->get_error_message()
			);
		}

		$responseCode = wp_remote_retrieve_response_code($response);
		$responseBody = wp_remote_retrieve_body($response);
		$data = json_decode($responseBody, true);

		if ($responseCode !== 200) {
			$errorMsg = isset($data['error']) ? $data['error'] : __('Connection failed', 'price-sync-connector');
			return new Price_Sync_StepResult(
				false,
				$errorMsg
			);
		}

		// Clear temporary keys
		delete_option('price_sync_consumer_key');
		delete_option('price_sync_consumer_secret');
		delete_option('price_sync_connection_token');
		delete_option('price_sync_connection_token_time');

		return new Price_Sync_StepResult(
			true,
			__('Successfully connected to Price Sync Dashboard!', 'price-sync-connector'),
			['redirect_url' => $data['redirect_url'] ?? null]
		);
	}
}
