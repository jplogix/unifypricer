<?php

class Sellbrite_CreateSellbriteUserStep implements Sellbrite_AutomationStep
{
	public static $username = 'sellbrite-integration';

	public function getName()
	{
		return __('Create a Sellbrite administrator user', 'sellbrite');
	}

	public function runStep()
	{
		$userId = username_exists(self::$username);

		if (empty($userId)) {
			$random_password = wp_generate_password(12, true);
			$userId          = wp_create_user(self::$username, $random_password, 'integration@sellbrite.com');
		}

		if (username_exists(self::$username) === false) {
			return new Sellbrite_StepResult(false, __('Could not create a user for this Sellbrite integration.'));
		}

		$user = get_user_by('id', $userId);

		if (!in_array('administrator', $user->roles)) {
			$user->remove_role('subscriber');
			$user->add_role('administrator');
		}

		return new Sellbrite_StepResult(true);
	}
}
