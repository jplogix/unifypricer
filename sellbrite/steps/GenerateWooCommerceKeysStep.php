<?php

class Sellbrite_GenerateWooCommerceKeysStep implements Sellbrite_AutomationStep
{
	public function getName()
	{
		return __('Generate WooCommerce API keys for the Sellbrite admin user', 'sellbrite');
	}

	public function runStep()
	{
		defineWooCommerceExtensionClass();

		if (!class_exists('Sellbrite_WC_Auth')) {
			return new Sellbrite_StepResult(false, 'Could not find WooCommerce plugin. Please try again.');
		}

		$user = get_user_by('login', Sellbrite_CreateSellbriteUserStep::$username);

		if (!$user) {
			return new Sellbrite_StepResult(false, 'Sellbrite Administrator user not found. Please try again.');
		}

		$apiKey = (new Sellbrite_WC_Auth())->createAPIKey($user->ID);

		// store the key and secret
		if (!empty($apiKey['consumer_key'])) {
			update_option('woocommerce_sellbrite_consumer_key', $apiKey['consumer_key']);
		}
		if (!empty($apiKey['consumer_secret'])) {
			update_option('woocommerce_sellbrite_consumer_secret', $apiKey['consumer_secret']);
		}

		return new Sellbrite_StepResult(true, null, $apiKey);
	}
}

function defineWooCommerceExtensionClass()
{
	if (class_exists('WC_Auth')) {
		class Sellbrite_WC_Auth extends WC_Auth
		{
			public function createAPIKey($userId)
			{
				return $this->create_keys(
					'Sellbrite Integration',
					$userId,
					'read_write'
				);
			}
		}
	}
}
