<?php

class Sellbrite_PermalinkSettingsStep implements Sellbrite_AutomationStep
{
	public function getName()
	{
		return __('Ensure proper permalink structure settings (everything except the default option)', 'sellbrite');
	}

	public function runStep()
	{
		$currentStructure = get_option('permalink_structure');

		if (!empty($currentStructure)) {
			return new Sellbrite_StepResult(true);
		}

		global $wp_rewrite;
		$wp_rewrite->set_permalink_structure('/%postname%/');

		return new Sellbrite_StepResult(true);
	}
}
