# WooCommerce OAuth Plugin Installation Guide

This guide will help you install the Price Sync OAuth plugin on your WooCommerce store to enable automatic OAuth authentication (no more manual API keys!).

## Prerequisites

- WordPress 5.8 or higher
- WooCommerce 5.0 or higher
- PHP 7.4 or higher
- Administrator access to your WordPress site

## Installation Steps

### Step 1: Upload the Plugin

1. Download the `woocommerce-oauth-plugin` folder
2. Compress it into a ZIP file (if not already)
3. Go to your WordPress Admin → Plugins → Add New
4. Click "Upload Plugin"
5. Choose the ZIP file and click "Install Now"
6. Activate the plugin

**OR** upload via FTP:

1. Extract the plugin folder
2. Upload `price-sync-oauth` folder to `/wp-content/plugins/`
3. Go to WordPress Admin → Plugins
4. Find "Price Sync OAuth" and click "Activate"

### Step 2: Configure OAuth Credentials

1. Go to **Settings → Price Sync OAuth** in your WordPress admin
2. You'll see your OAuth credentials:
   - **Client ID**
   - **Client Secret**
   - **Callback URL**
3. Click "Copy" for each credential

### Step 3: Add Credentials to Price Sync Dashboard

Add the WooCommerce OAuth credentials to your `.env` file:

```env
# WooCommerce OAuth (from WordPress plugin settings)
WOOCOMMERCE_OAUTH_CLIENT_ID=your_copied_client_id
WOOCOMMERCE_OAUTH_CLIENT_SECRET=your_copied_client_secret
```

### Step 4: Restart Your Backend

Restart your Price Sync Dashboard backend to load the new environment variables:

```bash
# Stop the current process (Ctrl+C)
# Then restart:
bun run dev
```

## How It Works

Once installed:

1. User clicks "Add Store" in Price Sync Dashboard
2. Enters store name and URL
3. Clicks "Connect Store"
4. Popup opens → WordPress login (if not logged in)
5. Click "Authorize" to approve access
6. Plugin automatically creates API keys
7. Store is connected! ✨

## Security Features

✅ **OAuth 2.0 Standard** - Industry-standard authentication protocol
✅ **Secure Token Storage** - Tokens stored securely in WordPress transients
✅ **One-Time Use Codes** - Authorization codes expire after 5 minutes
✅ **Automatic API Key Creation** - Creates read/write API keys automatically
✅ **Revocable Access** - Delete the API keys anytime to revoke access

## Troubleshooting

### Plugin activation fails

**Error**: "Plugin could not be activated because it triggered a fatal error"

**Solution**:
- Check PHP version (requires 7.4+)
- Check if WooCommerce is active
- Enable WordPress debug mode to see the actual error

### OAuth connection fails

**Error**: "WooCommerce OAuth plugin is not installed"

**Solution**:
1. Verify plugin is activated in WordPress
2. Check credentials match between WordPress and `.env` file
3. Clear WordPress cache
4. Ensure your store URL is accessible

### "Invalid client ID" error

**Solution**:
1. Go to Settings → Price Sync OAuth in WordPress
2. Copy the Client ID and Secret again
3. Update your `.env` file
4. Restart the backend server

## Testing the Connection

After installation:

1. Go to your Price Sync Dashboard
2. Click "Add Store"
3. Enter store name and WooCommerce URL
4. Click "Connect Store"
5. You should see the WordPress authorization page
6. Click "Authorize"
7. Success! Your store is connected

## Managing Access

### View Connected Stores

In WordPress Admin:
- Go to **WooCommerce → Settings → Advanced → REST API**
- Look for keys labeled "Price Sync Dashboard - [Store Name]"

### Revoke Access

To remove a store's access:
1. Go to **WooCommerce → Settings → Advanced → REST API**
2. Find the API key for that store
3. Click "Revoke" or "Delete"

### Regenerate Credentials

If you need to reset your OAuth credentials:
1. Go to **Settings → Price Sync OAuth**
2. Click "Regenerate Credentials"
3. Update your `.env` file with the new credentials
4. Restart the backend

## Support

If you encounter issues:
- Check WordPress debug log: `/wp-content/debug.log`
- Check browser console for JavaScript errors
- Verify all prerequisites are met
- Ensure your store URL is correct and accessible

## What's Created

When you authorize a store, the plugin automatically creates:
- WooCommerce API keys with read/write permissions
- OAuth tokens for secure communication
- Audit trail in REST API keys list

No manual API key creation needed!
