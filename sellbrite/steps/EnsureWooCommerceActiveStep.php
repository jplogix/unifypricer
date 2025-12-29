<?php

class Sellbrite_EnsureWooCommerceActiveStep implements Sellbrite_AutomationStep
{
	public function getName()
	{
		return __('Ensure the WooCommerce plugin is activated', 'sellbrite');
	}

	public function runStep()
	{
		if (is_plugin_active('woocommerce/woocommerce.php')) {
			return new Sellbrite_StepResult(true);
		}

		activate_plugin('woocommerce/woocommerce.php');
		delete_transient('_wc_activation_redirect');

		if (is_plugin_active('woocommerce/woocommerce.php')) {
			return new Sellbrite_StepResult(true);
		}

		return new Sellbrite_StepResult(false, __('Failed to activate the WooCommerce plugin.', 'sellbrite'));
	}
}
