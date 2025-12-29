<?php

class Price_Sync_CreateAPIKeysStep implements Price_Sync_Step
{
	public function getName()
	{
		return __('Generate API keys for Price Sync Dashboard', 'price-sync-connector');
	}

	public function runStep($token)
	{
		if (!class_exists('WC_Auth')) {
			return new Price_Sync_StepResult(
				false,
				__('WooCommerce REST API not available. Please ensure WooCommerce is properly installed.', 'price-sync-connector')
			);
		}

		// Get current user
		$currentUser = wp_get_current_user();

		if (!$currentUser->exists()) {
			return new Price_Sync_StepResult(
				false,
				__('You must be logged in to create API keys.', 'price-sync-connector')
			);
		}

		// Use WooCommerce's built-in API key generation
		$auth = new WC_Auth();

		try {
			$apiKey = $auth->create_keys(
				'Price Sync Dashboard - ' . date('Y-m-d H:i:s'),
				$currentUser->ID,
				'read_write'
			);

			if (empty($apiKey['consumer_key']) || empty($apiKey['consumer_secret'])) {
				return new Price_Sync_StepResult(
					false,
					__('Failed to generate API keys. Please try again.', 'price-sync-connector')
				);
			}

			// Store keys temporarily (will be sent in next step)
			update_option('price_sync_consumer_key', $apiKey['consumer_key']);
			update_option('price_sync_consumer_secret', $apiKey['consumer_secret']);
			update_option('price_sync_key_id', $apiKey['key_id']);

			return new Price_Sync_StepResult(
				true,
				__('API keys generated successfully.', 'price-sync-connector'),
				$apiKey
			);
		} catch (Exception $e) {
			return new Price_Sync_StepResult(
				false,
				__('Error generating API keys: ', 'price-sync-connector') . $e->getMessage()
			);
		}
	}
}
