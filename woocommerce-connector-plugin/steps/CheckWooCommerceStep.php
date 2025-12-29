<?php

class Price_Sync_CheckWooCommerceStep implements Price_Sync_Step
{
	public function getName()
	{
		return __('Check WooCommerce installation and version', 'price-sync-connector');
	}

	public function runStep($token)
	{
		// Check if WooCommerce is active
		if (!class_exists('WooCommerce')) {
			return new Price_Sync_StepResult(
				false,
				__('WooCommerce is not installed or activated. Please install WooCommerce first.', 'price-sync-connector')
			);
		}

		// Check WooCommerce version (requires 3.0+)
		global $woocommerce;
		$version = $woocommerce->version;

		if (version_compare($version, '3.0', '<')) {
			return new Price_Sync_StepResult(
				false,
				sprintf(__('WooCommerce version %s is installed. Version 3.0 or higher is required.', 'price-sync-connector'), $version)
			);
		}

		return new Price_Sync_StepResult(true);
	}
}
