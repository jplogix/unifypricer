<?php

class Price_Sync_EnableAPIStep implements Price_Sync_Step
{
	public function getName()
	{
		return __('Enable WooCommerce REST API', 'price-sync-connector');
	}

	public function runStep($token)
	{
		// Enable WooCommerce REST API
		update_option('woocommerce_api_enabled', 'yes');

		// Verify it was enabled
		if (get_option('woocommerce_api_enabled') !== 'yes') {
			return new Price_Sync_StepResult(
				false,
				__('Could not enable WooCommerce REST API. Please check your permissions.', 'price-sync-connector')
			);
		}

		return new Price_Sync_StepResult(true);
	}
}
