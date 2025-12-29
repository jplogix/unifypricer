# Price Sync Connector

A WordPress/WooCommerce plugin that enables one-click connection to the Price Sync Dashboard.

## About

This plugin simplifies the process of connecting your WooCommerce store to Price Sync Dashboard by:

- Automatically enabling WooCommerce REST API
- Configuring permalink settings
- Generating secure API keys
- Transmitting credentials securely to the dashboard

No manual configuration required - just click "Connect Store" and watch the progress!

## Installation

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

Quick summary:
1. Upload plugin to `/wp-content/plugins/`
2. Activate in WordPress admin
3. Connect from Price Sync Dashboard

## Requirements

- WordPress 5.0+
- WooCommerce 3.0+
- Administrator permissions

## Security

- Uses WooCommerce's native `WC_Auth` class for key generation
- Credentials transmitted via encrypted POST (not URL parameters)
- Connection tokens expire after 15 minutes
- All temporary data cleared after connection

## Files

- `price-sync-connector.php` - Main plugin file
- `steps/` - Connection step implementations
- `js/connector.js` - Frontend JavaScript for connection wizard
- `css/styles.css` - Styles for progress indicators
- `StepResult.php` - Step result data structure

## Support

For issues, see [INSTALL.md](INSTALL.md) troubleshooting section.

## License

GPL v2 or later
