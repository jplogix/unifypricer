<?php

class Price_Sync_SetPermalinksStep implements Price_Sync_Step
{
	public function getName()
	{
		return __('Configure permalink settings for REST API', 'price-sync-connector');
	}

	public function runStep($token)
	{
		$currentStructure = get_option('permalink_structure');

		// If not empty, we're good (anything except default works)
		if (!empty($currentStructure)) {
			return new Price_Sync_StepResult(true);
		}

		// Set to post name structure
		global $wp_rewrite;
		$wp_rewrite->set_permalink_structure('/%postname%/');
		flush_rewrite_rules();

		return new Price_Sync_StepResult(true);
	}
}
