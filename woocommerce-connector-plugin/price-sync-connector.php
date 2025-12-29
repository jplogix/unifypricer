<?php
/*
Plugin Name: Price Sync Connector
Description: Connect your WooCommerce store to Price Sync Dashboard with one click
Version: 1.0.0
Author: Price Sync
License: GPL2
Text Domain: price-sync-connector
Requires Plugins: woocommerce
*/

class Price_Sync_Connector
{
	/** @var Price_Sync_Step[] */
	public $steps = [];

	public function registerPluginHooks()
	{
		add_menu_page(
			'Price Sync Connector',
			'Price Sync',
			'manage_options',
			'price-sync-connector',
			[$this, 'renderPage'],
			'dashicons-admin-generic',
			30
		);
		add_action('admin_action_price_sync_connect', [$this, 'connect']);
		add_action('admin_enqueue_scripts', [$this, 'enqueueScripts']);
		add_action('wp_ajax_price_sync_get_connection_token', [$this, 'getConnectionToken']);
		add_action('wp_ajax_nopriv_price_sync_get_connection_token', [$this, 'getConnectionToken']);
	}

	function connect()
	{
		$stepIndex = isset($_POST['step']) ? intval($_POST['step']) : -1;
		$token = isset($_POST['token']) ? sanitize_text_field($_POST['token']) : '';

		if (empty($token)) {
			wp_send_json_error(['message' => __('Invalid connection token.', 'price-sync-connector')]);
		}

		// Verify token exists and is valid
		$storedToken = get_option('price_sync_connection_token');
		if ($token !== $storedToken) {
			wp_send_json_error(['message' => __('Connection token expired or invalid.', 'price-sync-connector')]);
		}

		$result = $this->runStep($stepIndex, $token);

		wp_send_json($result);
	}

	/**
	 * @param int $stepIndex
	 * @param string $token
	 *
	 * @return Price_Sync_StepResult
	 */
	function runStep($stepIndex, $token)
	{
		if ($stepIndex < 0 || $stepIndex >= count($this->steps)) {
			return new Price_Sync_StepResult(
				false,
				__('Invalid connection step received. Please contact support.', 'price-sync-connector')
			);
		}

		return $this->steps[$stepIndex]->runStep($token);
	}

	function getConnectionToken()
	{
		$token = isset($_GET['token']) ? sanitize_text_field($_GET['token']) : '';

		if (empty($token)) {
			wp_send_json_error(['message' => 'Token required']);
		}

		// Store token with 15 minute expiration
		update_option('price_sync_connection_token', $token);
		update_option('price_sync_connection_token_time', time());

		wp_send_json_success([
			'site_url' => home_url(),
			'store_name' => get_bloginfo('name'),
		]);
	}

	function enqueueScripts()
	{
		// Only load on our plugin page
		if (!isset($_GET['page']) || $_GET['page'] !== 'price-sync-connector') {
			return;
		}

		wp_enqueue_script(
			'price-sync-connector-js',
			plugin_dir_url(__FILE__) . 'js/connector.js',
			array('jquery'),
			'1.0.0'
		);

		wp_enqueue_style(
			'price-sync-connector-css',
			plugin_dir_url(__FILE__) . 'css/styles.css',
			array(),
			'1.0.0'
		);

		// Pass data to JavaScript
		wp_localize_script('price-sync-connector-js', 'priceSyncConnector', [
			'ajaxUrl' => admin_url('admin-ajax.php'),
			'adminUrl' => admin_url('admin.php'),
			'token' => isset($_GET['token']) ? sanitize_text_field($_GET['token']) : '',
			'stepCount' => count($this->steps) > 0 ? count($this->steps) : 0,
		]);
	}

	function renderPage()
	{
		$token = isset($_GET['token']) ? sanitize_text_field($_GET['token']) : '';

		// Check if WooCommerce is active
		if (!class_exists('WooCommerce')) {
			echo '<div class="wrap">';
			echo '<h1>Price Sync Connector</h1>';
			echo '<div class="notice notice-error inline"><p>';
			echo __('WooCommerce is not installed or activated. Please install and activate WooCommerce first.', 'price-sync-connector');
			echo '</p></div>';
			echo '</div>';
			return;
		}

		if (empty($token)) {
			echo '<div class="wrap">';
			echo '<h1>Price Sync Connector</h1>';
			echo '<div class="notice notice-warning inline"><p>';
			echo __('Please connect from the Price Sync Dashboard. A valid connection token is required.', 'price-sync-connector');
			echo '</p></div>';
			echo '</div>';
			return;
		}

		// Check if steps are initialized
		if (empty($this->steps)) {
			echo '<div class="wrap">';
			echo '<h1>Price Sync Connector</h1>';
			echo '<div class="notice notice-error inline"><p>';
			echo __('Connection steps are not initialized. Please try deactivating and reactivating the plugin.', 'price-sync-connector');
			echo '</p></div>';
			echo '</div>';
			return;
		}

		?>
		<div class="wrap">
			<h1>Price Sync Connector</h1>

			<div id="connector-intro">
				<h2><?php _e('Connect Your Store to Price Sync Dashboard', 'price-sync-connector'); ?></h2>
				<p><?php _e('Click the button below to securely connect your WooCommerce store. This will automatically:', 'price-sync-connector'); ?></p>
				<ul style="list-style: disc inside; margin: 10px 0 20px 20px;">
					<?php foreach ($this->steps as $step) { ?>
						<li><?php echo esc_html($step->getName()); ?></li>
					<?php } ?>
				</ul>
				<button type="button" id="start-connection" class="button button-primary button-hero">
					<?php _e('Connect Store', 'price-sync-connector'); ?>
				</button>
			</div>

			<div id="connector-progress" style="display: none;">
				<h2><?php _e('Connecting...', 'price-sync-connector'); ?></h2>
				<ol id="step-list">
					<?php foreach ($this->steps as $index => $step) { ?>
						<li id="step-<?php echo $index; ?>" class="step-pending">
							<?php echo esc_html($step->getName()); ?>
						</li>
					<?php } ?>
				</ol>
				<div id="connection-result"></div>
			</div>
		</div>
		<?php
	}
}

include_once('StepResult.php');
include_once('steps/Price_Sync_Step.php');
include_once('steps/CheckWooCommerceStep.php');
include_once('steps/EnableAPIStep.php');
include_once('steps/SetPermalinksStep.php');
include_once('steps/CreateAPIKeysStep.php');
include_once('steps/SendCredentialsStep.php');

$priceSyncConnector = new Price_Sync_Connector();

// Initialize steps after all plugins are loaded
add_action('plugins_loaded', function() use ($priceSyncConnector) {
	// Only initialize if WooCommerce is active
	if (class_exists('WooCommerce')) {
		$priceSyncConnector->steps[] = new Price_Sync_CheckWooCommerceStep();
		$priceSyncConnector->steps[] = new Price_Sync_EnableAPIStep();
		$priceSyncConnector->steps[] = new Price_Sync_SetPermalinksStep();
		$priceSyncConnector->steps[] = new Price_Sync_CreateAPIKeysStep();
		$priceSyncConnector->steps[] = new Price_Sync_SendCredentialsStep();
	}
}, 10);

add_action('admin_menu', [$priceSyncConnector, 'registerPluginHooks']);
