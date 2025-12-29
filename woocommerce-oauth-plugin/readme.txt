=== Price Sync OAuth ===
Contributors: yourname
Tags: oauth, woocommerce, api, price-sync
Requires at least: 5.8
Tested up to: 6.4
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

OAuth 2.0 server for Price Sync Dashboard integration with WooCommerce.

== Description ==

This plugin enables automatic OAuth authentication for the Price Sync Dashboard, eliminating the need to manually create API keys.

**Features:**

* OAuth 2.0 authorization flow
* Automatic API key generation
* Secure token management
* One-click store connection
* Compatible with Price Sync Dashboard

== Installation ==

1. Upload the `price-sync-oauth` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > Price Sync OAuth
4. Copy your Client ID and Client Secret
5. Add them to your Price Sync Dashboard environment variables

== Configuration ==

After activating the plugin:

1. Navigate to Settings > Price Sync OAuth in your WordPress admin
2. Copy the Client ID and Client Secret
3. Add to your `.env` file:

`
WOOCOMMERCE_OAUTH_CLIENT_ID=your_client_id
WOOCOMMERCE_OAUTH_CLIENT_SECRET=your_client_secret
`

4. Your store is now ready for OAuth connections!

== Frequently Asked Questions ==

= Is this plugin secure? =

Yes. It uses WordPress nonces for form validation, transients for secure token storage, and follows OAuth 2.0 best practices.

= What permissions does it request? =

The plugin requests read/write access to products so it can sync prices. This is done through WooCommerce API keys with the `read_write` permission.

= Can I revoke access? =

Yes. Simply go to WooCommerce > Settings > Advanced > REST API and delete the keys created by Price Sync Dashboard.

== Changelog ==

= 1.0.0 =
* Initial release
