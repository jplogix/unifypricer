<?php

class Sellbrite_EnableWooCommerceAPIStep implements Sellbrite_AutomationStep
{
	public function getName()
	{
		return __('Enable WooCommerce REST API', 'sellbrite');
	}

	public function runStep()
	{
		update_option('woocommerce_api_enabled', 'yes');
		return new Sellbrite_StepResult(true);
	}
}
