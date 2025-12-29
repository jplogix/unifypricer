# WooCommerce OAuth Plugin

A WordPress plugin that provides OAuth 2.0 authentication for WooCommerce stores, enabling automatic connection to the Price Sync Dashboard.

## Features

- ✅ OAuth 2.0 authorization server
- ✅ Automatic API key generation
- ✅ Secure token management
- ✅ One-click store authorization
- ✅ Compatible with WooCommerce REST API
- ✅ Read/write permissions for price syncing

## Requirements

- WordPress 5.8+
- WooCommerce 5.0+
- PHP 7.4+

## Quick Start

1. Upload plugin to `/wp-content/plugins/`
2. Activate in WordPress admin
3. Go to Settings → Price Sync OAuth
4. Copy Client ID and Secret to your `.env` file

## Files

- `price-sync-oauth.php` - Main plugin file with OAuth server implementation
- `readme.txt` - WordPress plugin readme

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

## Security

- Uses WordPress nonces for form validation
- OAuth 2.0 compliant authorization flow
- One-time use authorization codes (5 min expiry)
- Access tokens expire after 30 days
- Automatic API key creation via WooCommerce REST API

## API Endpoints

### Authorize Endpoint
```
GET /wp-json/price-sync-oauth/v1/authorize
```

Parameters:
- `client_id` - OAuth client ID
- `redirect_uri` - Callback URL
- `response_type` - Must be "code"
- `state` - CSRF protection token
- `store_name` - Name for the store

### Token Endpoint
```
POST /wp-json/price-sync-oauth/v1/token
```

Body (JSON):
- `grant_type` - Must be "authorization_code"
- `code` - Authorization code from authorize endpoint
- `client_id` - OAuth client ID
- `client_secret` - OAuth client secret
- `redirect_uri` - Callback URL

Returns:
- `access_token` - Bearer token
- `consumer_key` - WooCommerce API consumer key
- `consumer_secret` - WooCommerce API consumer secret
- `expires_in` - Token expiry time

### Callback Endpoint
```
GET /wc-api/price-sync-oauth/callback
```

Handles the OAuth approval page.

## Environment Variables

Add to your Price Sync Dashboard `.env`:

```env
WOOCOMMERCE_OAUTH_CLIENT_ID=your_client_id
WOOCOMMERCE_OAUTH_CLIENT_SECRET=your_client_secret
```

## Development

### Building the Plugin

The plugin is a single PHP file - no build step required.

### Testing

1. Install in a WordPress test environment
2. Activate the plugin
3. Go to Settings → Price Sync OAuth
4. Test OAuth flow with Price Sync Dashboard

## License

GPL v2 or later

## Support

For issues and questions:
- GitHub: https://github.com/yourusername/price-sync-dashboard/issues
- Documentation: See INSTALL.md
