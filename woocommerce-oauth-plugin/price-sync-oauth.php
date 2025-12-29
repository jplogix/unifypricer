<?php
/**
 * Plugin Name: Price Sync OAuth
 * Description: OAuth 2.0 server for Price Sync Dashboard integration with WooCommerce
 * Version: 1.0.0
 * Author: Jo Cabral
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: price-sync-oauth
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PS_OAUTH_VERSION', '1.0.0');
define('PS_OAUTH_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PS_OAUTH_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main plugin class
 */
class Price_Sync_OAuth
{

    /**
     * Single instance of the class
     */
    private static $instance = null;

    /**
     * Get instance
     */
    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct()
    {
        $this->init();
    }

    /**
     * Initialize plugin
     */
    private function init()
    {
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));

        // Register OAuth endpoints
        add_action('rest_api_init', array($this, 'register_oauth_routes'));

        // Add custom query vars for OAuth flow
        add_filter('query_vars', array($this, 'add_query_vars'));

        // Add rewrite rule for OAuth approval page
        add_action('init', array($this, 'add_rewrite_rules'));

        // Handle template redirect
        add_action('template_redirect', array($this, 'template_redirect'));

        // Plugin activation/deactivation
        register_activation_hook(__FILE__, array('Price_Sync_OAuth', 'activate'));
        register_deactivation_hook(__FILE__, array('Price_Sync_OAuth', 'deactivate'));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu()
    {
        add_options_page(
            'Price Sync OAuth',
            'Price Sync OAuth',
            'manage_options',
            'price-sync-oauth',
            array($this, 'render_admin_page')
        );
    }

    /**
     * Render admin page
     */
    public function render_admin_page()
    {
        $client_id = get_option('ps_oauth_client_id', wp_generate_password(32, false));
        $client_secret = get_option('ps_oauth_client_secret', wp_generate_password(64, false));

        if (empty(get_option('ps_oauth_client_id'))) {
            update_option('ps_oauth_client_id', $client_id);
        }
        if (empty(get_option('ps_oauth_client_secret'))) {
            update_option('ps_oauth_client_secret', $client_secret);
        }

        $callback_url = home_url('/wc-api/price-sync-oauth/callback');

        ?>
        <div class="wrap">
            <h1>Price Sync OAuth Configuration</h1>

            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2>OAuth Credentials</h2>
                <p>Use these credentials in your Price Sync Dashboard:</p>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">Client ID</th>
                        <td>
                            <code><?php echo esc_html($client_id); ?></code>
                            <button type="button" class="button button-small"
                                onclick="navigator.clipboard.writeText('<?php echo esc_js($client_id); ?>'); alert('Copied!');">Copy</button>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Client Secret</th>
                        <td>
                            <code><?php echo esc_html($client_secret); ?></code>
                            <button type="button" class="button button-small"
                                onclick="navigator.clipboard.writeText('<?php echo esc_js($client_secret); ?>'); alert('Copied!');">Copy</button>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Callback URL</th>
                        <td>
                            <code><?php echo esc_html($callback_url); ?></code>
                            <button type="button" class="button button-small"
                                onclick="navigator.clipboard.writeText('<?php echo esc_js($callback_url); ?>'); alert('Copied!');">Copy</button>
                        </td>
                    </tr>
                </table>

                <hr>

                <h2>Actions</h2>
                <p>
                    <button type="button" class="button"
                        onclick="if(confirm('Regenerate credentials? This will invalidate existing connections.')) { location.href='<?php echo esc_url(admin_url('admin.php?page=price-sync-oauth&action=regenerate&_wpnonce=' . wp_create_nonce('regenerate_ps_oauth'))); ?>'; ?>">
                        Regenerate Credentials
                    </button>
                </p>

                <h2>Instructions</h2>
                <ol>
                    <li>Copy the Client ID and Client Secret above</li>
                    <li>Add them to your Price Sync Dashboard environment variables:</li>
                    <pre>WOOCOMMERCE_OAUTH_CLIENT_ID=<?php echo esc_html($client_id); ?>
        WOOCOMMERCE_OAUTH_CLIENT_SECRET=<?php echo esc_html($client_secret); ?></pre>
                    <li>Your store is now ready for OAuth connections!</li>
                </ol>
            </div>
        </div>
        <?php

        // Handle regeneration
        if (isset($_GET['action']) && $_GET['action'] === 'regenerate' && check_admin_referer('regenerate_ps_oauth')) {
            update_option('ps_oauth_client_id', wp_generate_password(32, false));
            update_option('ps_oauth_client_secret', wp_generate_password(64, false));
            echo '<script>location.href="' . esc_url(admin_url('admin.php?page=price-sync-oauth')) . '";</script>';
        }
    }

    /**
     * Register OAuth routes
     */
    public function register_oauth_routes()
    {
        // Authorize endpoint
        register_rest_route('price-sync-oauth/v1', '/authorize', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_authorize_request'),
            'permission_callback' => '__return_true',
        ));

        // Token endpoint
        register_rest_route('price-sync-oauth/v1', '/token', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_token_request'),
            'permission_callback' => '__return_true',
        ));

        // Callback endpoint
        register_rest_route('price-sync-oauth', '/callback', array(
            'methods' => 'GET',
            'callback' => array($this, 'handle_callback'),
            'permission_callback' => '__return_true',
        ));
    }

    /**
     * Handle authorize request
     */
    public function handle_authorize_request($request)
    {
        $client_id = $request->get_param('client_id');
        $redirect_uri = $request->get_param('redirect_uri');
        $response_type = $request->get_param('response_type');
        $state = $request->get_param('state');
        $store_name = $request->get_param('store_name');

        // Validate client_id
        if ($client_id !== get_option('ps_oauth_client_id')) {
            return new WP_Error('invalid_client', 'Invalid client ID', array('status' => 401));
        }

        // Check if user is logged in
        if (!is_user_logged_in()) {
            // Redirect to login with return URL
            $login_url = wp_login_url(add_query_arg(array(
                'client_id' => $client_id,
                'redirect_uri' => $redirect_uri,
                'response_type' => $response_type,
                'state' => $state,
                'store_name' => $store_name,
            ), home_url('/wc-api/price-sync-oauth/approve')));

            wp_redirect($login_url);
            exit;
        }

        // Store OAuth request data in transient
        $oauth_data = array(
            'client_id' => $client_id,
            'redirect_uri' => $redirect_uri,
            'state' => $state,
            'store_name' => $store_name,
            'user_id' => get_current_user_id(),
        );

        set_transient('ps_oauth_request_' . $state, $oauth_data, 15 * MINUTE_IN_SECONDS);

        // Redirect to approval page
        $approval_url = add_query_arg(array(
            'state' => $state,
            'store_name' => $store_name,
        ), home_url('/wc-api/price-sync-oauth/approve'));

        wp_redirect($approval_url);
        exit;
    }

    /**
     * Handle OAuth approval page
     */
    public function handle_oauth_approval()
    {
        if (!isset($_GET['state'])) {
            return;
        }

        $state = sanitize_text_field($_GET['state']);
        $oauth_data = get_transient('ps_oauth_request_' . $state);

        if (!$oauth_data) {
            wp_die('Invalid or expired OAuth request');
        }

        // Check if user is logged in
        if (!is_user_logged_in()) {
            return; // Will redirect to login
        }

        // Handle approval
        if (isset($_POST['approve']) && isset($_POST['state']) && check_admin_referer('ps_oauth_approve_' . $_POST['state'])) {
            $state = sanitize_text_field($_POST['state']);

            // Generate authorization code
            $auth_code = wp_generate_password(64, false);
            $oauth_data = get_transient('ps_oauth_request_' . $state);

            if ($oauth_data) {
                // Store auth code with expiration
                set_transient('ps_auth_code_' . $auth_code, array(
                    'user_id' => get_current_user_id(),
                    'client_id' => $oauth_data['client_id'],
                    'redirect_uri' => $oauth_data['redirect_uri'],
                    'state' => $state,
                    'store_name' => $oauth_data['store_name'],
                ), 5 * MINUTE_IN_SECONDS);

                // Redirect back to client with auth code
                $redirect_url = add_query_arg(array(
                    'code' => $auth_code,
                    'state' => $state,
                ), $oauth_data['redirect_uri']);

                wp_redirect($redirect_url);
                exit;
            }
        }

        // Handle denial
        if (isset($_POST['deny']) && isset($_POST['state']) && check_admin_referer('ps_oauth_approve_' . $_POST['state'])) {
            $state = sanitize_text_field($_POST['state']);
            $oauth_data = get_transient('ps_oauth_request_' . $state);

            if ($oauth_data) {
                $redirect_url = add_query_arg(array(
                    'error' => 'access_denied',
                    'state' => $state,
                ), $oauth_data['redirect_uri']);

                wp_redirect($redirect_url);
                exit;
            }
        }

        // Show approval page
        $this->render_approval_page($oauth_data);
        exit;
    }

    /**
     * Render approval page
     */
    private function render_approval_page($oauth_data)
    {
        ?>
        <!DOCTYPE html>
        <html>

        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Authorize Price Sync</title>
            <?php wp_head(); ?>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }

                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    width: 90%;
                }

                h1 {
                    margin: 0 0 10px 0;
                    color: #1a202c;
                }

                .app-info {
                    background: #f7fafc;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }

                .permissions {
                    margin: 20px 0;
                }

                .permission {
                    display: flex;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .permission:last-child {
                    border-bottom: none;
                }

                .permission-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 12px;
                    background: #48bb78;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                }

                .buttons {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }

                .button {
                    flex: 1;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .button-approve {
                    background: #48bb78;
                    color: white;
                }

                .button-approve:hover {
                    background: #38a169;
                }

                .button-deny {
                    background: #e2e8f0;
                    color: #4a5568;
                }

                .button-deny:hover {
                    background: #cbd5e0;
                }
            </style>
        </head>

        <body>
            <div class="container">
                <h1>Authorize Price Sync</h1>
                <p>Price Sync Dashboard is requesting access to your WooCommerce store</p>

                <div class="app-info">
                    <strong>Store:</strong> <?php echo esc_html(get_bloginfo('name')); ?><br>
                    <strong>Application:</strong> Price Sync Dashboard
                </div>

                <div class="permissions">
                    <h3>This application will be able to:</h3>
                    <div class="permission">
                        <div class="permission-icon">✓</div>
                        <span>Read and manage products</span>
                    </div>
                    <div class="permission">
                        <div class="permission-icon">✓</div>
                        <span>Update product prices</span>
                    </div>
                    <div class="permission">
                        <div class="permission-icon">✓</div>
                        <span>Sync product data</span>
                    </div>
                </div>

                <form method="post">
                    <?php wp_nonce_field('ps_oauth_approve_' . $oauth_data['state'], 'ps_oauth_nonce'); ?>
                    <input type="hidden" name="state" value="<?php echo esc_attr($oauth_data['state']); ?>">

                    <div class="buttons">
                        <button type="submit" name="deny" class="button button-deny">Deny</button>
                        <button type="submit" name="approve" class="button button-approve">Authorize</button>
                    </div>
                </form>
            </div>
        </body>

        </html>
        <?php
    }

    /**
     * Handle token request
     */
    public function handle_token_request($request)
    {
        $body = $request->get_json_params();
        $grant_type = isset($body['grant_type']) ? $body['grant_type'] : '';
        $code = isset($body['code']) ? $body['code'] : '';
        $client_id = isset($body['client_id']) ? $body['client_id'] : '';
        $client_secret = isset($body['client_secret']) ? $body['client_secret'] : '';
        $redirect_uri = isset($body['redirect_uri']) ? $body['redirect_uri'] : '';

        // Validate grant type
        if ($grant_type !== 'authorization_code') {
            return new WP_Error('invalid_grant', 'Invalid grant type', array('status' => 400));
        }

        // Validate client credentials
        if ($client_id !== get_option('ps_oauth_client_id') || $client_secret !== get_option('ps_oauth_client_secret')) {
            return new WP_Error('invalid_client', 'Invalid client credentials', array('status' => 401));
        }

        // Get auth code data
        $auth_data = get_transient('ps_auth_code_' . $code);

        if (!$auth_data || $auth_data['client_id'] !== $client_id || $auth_data['redirect_uri'] !== $redirect_uri) {
            return new WP_Error('invalid_grant', 'Invalid authorization code', array('status' => 400));
        }

        // Delete auth code (one-time use)
        delete_transient('ps_auth_code_' . $code);

        // Generate access token and keys
        $access_token = wp_generate_password(64, false);
        $consumer_key = 'ck_' . wp_generate_password(32, false);
        $consumer_secret = 'cs_' . wp_generate_password(64, false);

        // Create API keys
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'woocommerce_api_keys',
            array(
                'user_id' => $auth_data['user_id'],
                'description' => 'Price Sync Dashboard - ' . $auth_data['store_name'],
                'permissions' => 'read_write',
                'consumer_key' => wc_api_hash($consumer_key),
                'consumer_secret' => wc_api_hash($consumer_secret),
                'truncated_key' => substr($consumer_key, -7),
                'last_access' => current_time('mysql'),
            ),
            array('%d', '%s', '%s', '%s', '%s', '%s', '%s')
        );

        $key_id = $wpdb->insert_id;

        // Store access token with key info
        set_transient('ps_access_token_' . $access_token, array(
            'user_id' => $auth_data['user_id'],
            'key_id' => $key_id,
            'consumer_key' => $consumer_key,
            'consumer_secret' => $consumer_secret,
        ), DAY_IN_SECONDS * 30);

        return array(
            'access_token' => $access_token,
            'token_type' => 'Bearer',
            'consumer_key' => $consumer_key,
            'consumer_secret' => $consumer_secret,
            'expires_in' => DAY_IN_SECONDS * 30,
        );
    }

    /**
     * Handle callback
     */
    public function handle_callback($request)
    {
        // This is handled by the approval page
        return array('message' => 'OAuth callback received');
    }

    /**
     * Add custom query vars
     */
    public function add_query_vars($vars)
    {
        $vars[] = 'ps_oauth_state';
        $vars[] = 'ps_oauth_store_name';
        return $vars;
    }

    /**
     * Add rewrite rules
     */
    public function add_rewrite_rules()
    {
        add_rewrite_rule(
            '^wc-api/price-sync-oauth/approve/?$',
            'index.php?ps_oauth_approve=1',
            'top'
        );
    }

    /**
     * Template redirect for approval page
     */
    public function template_redirect()
    {
        if (get_query_var('ps_oauth_approve')) {
            $this->handle_oauth_approval();
        }
    }

    /**
     * Plugin activation
     */
    public static function activate()
    {
        // Generate client credentials
        if (empty(get_option('ps_oauth_client_id'))) {
            update_option('ps_oauth_client_id', wp_generate_password(32, false));
        }
        if (empty(get_option('ps_oauth_client_secret'))) {
            update_option('ps_oauth_client_secret', wp_generate_password(64, false));
        }

        // Add rewrite rules
        add_rewrite_rule(
            '^wc-api/price-sync-oauth/approve/?$',
            'index.php?ps_oauth_approve=1',
            'top'
        );
        flush_rewrite_rules();
    }

    /**
     * Plugin deactivation
     */
    public static function deactivate()
    {
        flush_rewrite_rules();
    }
}

// Initialize plugin
function ps_oauth_init()
{
    return Price_Sync_OAuth::get_instance();
}
add_action('plugins_loaded', 'ps_oauth_init');

// Activation/Deactivation hooks
register_activation_hook(__FILE__, array('Price_Sync_OAuth', 'activate'));
register_deactivation_hook(__FILE__, array('Price_Sync_OAuth', 'deactivate'));
