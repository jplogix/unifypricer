<?php
/*
Plugin Name: Sellbrite
Description: Helps you easily integrate your WooCommerce store with Sellbrite.
Version: 1.0.3
Author: GoDaddy
Author URI: https://godaddy.com
License: GPL2
Text Domain: sellbrite
Requires Plugins: woocommerce
*/

class SellbritePlugin
{
	/** @var Sellbrite_AutomationStep[] */
	public $steps = [];

	public function registerPluginHooks()
	{
		add_menu_page('Sellbrite Integration', 'Sellbrite', 'manage_options', 'sellbrite', [$this, 'renderPage']);
		add_action('admin_action_sellbrite_integrate', [$this, 'integrate']);
		add_action('admin_enqueue_scripts', [$this, 'enqueueScripts']);
	}

	function integrate()
	{
		$stepIndex = isset($_POST['step']) ? intval($_POST['step']) : -1;
		$result    = $this->runStep($stepIndex);

		echo json_encode($result);
		exit();
	}

	/**
	 * @param int $stepIndex
	 *
	 * @return Sellbrite_StepResult
	 */
	function runStep($stepIndex)
	{
		if ($stepIndex < 0 || $stepIndex >= count($this->steps)) {
			return new Sellbrite_StepResult(
				false,
				__('Invalid integration step received. Please contact our support.', 'sellbrite')
			);
		}

		return $this->steps[$stepIndex]->runStep();
	}

	function enqueueScripts()
	{
		wp_enqueue_script(
			'sellbrite-js',
			plugin_dir_url(__FILE__).'js/sellbrite-integration.js',
			array('jquery'),
			'0.1'
		);

		wp_enqueue_style(
			'sellbrite-css',
			plugin_dir_url(__FILE__).'css/styles.css',
			array(),
			'0.1'
		);
	}

	function renderPage()
	{
		echo '<h1>Sellbrite Integration</h1>';

		if (!empty(get_option('woocommerce_sellbrite_consumer_key'))) {
			$buttonLabel = __('Re-connect to Sellbrite', 'sellbrite');
		} else {
			$buttonLabel = __('Connect to Sellbrite', 'sellbrite');
		}

		?>
		<script>
			var sellbriteBaseUrl = <?= json_encode(admin_url('admin.php')); ?>;
			var sellbriteStoreUrl = <?= json_encode(home_url()); ?>;
			var integrationStepCount = <?= json_encode(count($this->steps)); ?>;
			var defaultIntegrationError = <?= json_encode(__('Could not connect to the website to complete the integration step. Please, try again.', 'sellbrite')) ?>;
			var successfulIntegrationMessage = <?= json_encode(__('Successfully prepared to integrate with Sellbrite!', 'sellbrite')) ?>;
		</script>
		<div id="integration-description">
			<p>Easily activate Sellbrite Integration with WooCommerce. Connect Sellbrite and WooCommerce on your website
				with a single click of the button below.</p>
			<p>By clicking the button below, you are acknowledging that Sellbrite can make the following changes:</p>
			<ul style="list-style: circle inside;">
				<?php foreach ($this->steps as $index => $step) { ?>
					<li><?= $step->getName() ?></li>
				<?php } ?>
			</ul>
			<form method="post" action="<?= admin_url('admin.php'); ?>" novalidate="novalidate">
				<p class="submit">
					<input type="hidden" name="action" value="sellbrite_integrate"/>
					<input type="hidden" name="step" value="0"/>
					<input type="submit" value="<?php echo esc_attr($buttonLabel); ?>" class="button button-primary">
				</p>
			</form>
		</div>
		<div id="integration-progress" style="display: none">
			Integration progress:
			<ol>
				<?php foreach ($this->steps as $index => $step) { ?>
					<li id="sellbrite-step-<?= $index ?>">
						<?= $step->getName() ?>
					</li>
				<?php } ?>
			</ol>
			<p id="integration-result">
			</p>
		</div>
		<?php
	}
}

include_once('StepResult.php');
include_once('steps/Sellbrite_AutomationStep.php');
include_once('steps/EnsureWooCommerceVersionStep.php');
include_once('steps/EnsureWooCommerceActiveStep.php');
include_once('steps/EnableWooCommerceAPIStep.php');
include_once('steps/PermalinkSettingsStep.php');
include_once('steps/CreateSellbriteUserStep.php');
include_once('steps/GenerateWooCommerceKeysStep.php');
include_once('steps/SendWooCommerceKeysStep.php');

$sellbritePlugin          = new SellbritePlugin();
$sellbritePlugin->steps[] = new Sellbrite_EnsureWooCommerceVersionStep();
$sellbritePlugin->steps[] = new Sellbrite_EnsureWooCommerceActiveStep();
$sellbritePlugin->steps[] = new Sellbrite_EnableWooCommerceAPIStep();
$sellbritePlugin->steps[] = new Sellbrite_PermalinkSettingsStep();
$sellbritePlugin->steps[] = new Sellbrite_CreateSellbriteUserStep();
$sellbritePlugin->steps[] = new Sellbrite_GenerateWooCommerceKeysStep();
$sellbritePlugin->steps[] = new Sellbrite_SendWooCommerceKeysStep();

add_action('admin_menu', [$sellbritePlugin, 'registerPluginHooks']);
