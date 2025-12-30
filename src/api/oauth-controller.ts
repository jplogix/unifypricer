import { Request, Response } from 'express';
import crypto from 'crypto';

interface OAuthState {
  storeName: string;
  storeUrl: string;
  platform: 'shopify' | 'woocommerce';
  timestamp: number;
  [key: string]: any; // Allow additional properties
}

const oauthStates = new Map<string, OAuthState>();

export class OAuthController {
  // Shopify OAuth
  initiateShopifyOAuth(req: Request, res: Response): void {
    const { shop, storeName, redirectUrl } = req.query;

    if (!shop || typeof shop !== 'string') {
      res.status(400).json({ error: 'Shop domain is required' });
      return;
    }

    // Validate shop domain format
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/)) {
      res.status(400).json({ error: 'Invalid shop domain format' });
      return;
    }

    // Check Shopify API credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret || apiKey === 'your_api_key' || apiSecret === 'your_api_secret') {
      res.status(500).json({
        error: 'Shopify OAuth credentials not configured',
        message: 'Backend Shopify API credentials not configured. Please add SHOPIFY_API_KEY and SHOPIFY_API_SECRET to your backend .env file and restart the server.',
        help: {
          howToSetup: 'Create a Shopify app at https://partners.shopify.com/ to get your API credentials',
          required: ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET']
        }
      });
      return;
    }

    // Generate state parameter for security
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    oauthStates.set(state, {
      storeName: (storeName as string) || shop.split('.')[0],
      storeUrl: `https://${shop}`,
      platform: 'shopify',
      timestamp: Date.now()
    });

    // Clean up old states (older than 10 minutes)
    const now = Date.now();
    for (const [key, value] of oauthStates.entries()) {
      if (now - value.timestamp > 600000) {
        oauthStates.delete(key);
      }
    }

    // Build Shopify OAuth URL
    const scopes = ['read_products', 'write_products'];
    const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/oauth/shopify/callback`;

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.append('client_id', apiKey);
    authUrl.searchParams.append('scope', scopes.join(','));
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');

    res.json({
      authUrl: authUrl.toString(),
      state
    });
  }

  async handleShopifyCallback(req: Request, res: Response): Promise<void> {
    const { code, shop, state } = req.query;

    if (!code || !shop || !state) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    // Verify state
    const storedState = oauthStates.get(state as string);
    if (!storedState) {
      res.status(400).json({ error: 'Invalid or expired state' });
      return;
    }

    if (storedState.platform !== 'shopify') {
      res.status(400).json({ error: 'Platform mismatch' });
      return;
    }

    try {
      // Exchange code for access token
      const apiKey = process.env.SHOPIFY_API_KEY || 'your_api_key';
      const apiSecret = process.env.SHOPIFY_API_SECRET || 'your_api_secret';
      const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/oauth/shopify/callback`;

      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for access token');
      }

      const tokenData = await tokenResponse.json() as any;

      // Return success with store data
      const storeData = {
        storeId: storedState.storeName.toLowerCase().replace(/\s+/g, '-'),
        storeName: storedState.storeName,
        platform: 'shopify' as const,
        shopDomain: `https://${shop}`,
        accessToken: tokenData.access_token,
        syncInterval: 60,
        enabled: true
      };

      // Store in OAuth states map for polling (with 30 second expiry)
      const oauthResultKey = `shopify-result-${state}`;
      oauthStates.set(oauthResultKey, {
        ...storeData,
        storeUrl: `https://${shop}`,
        timestamp: Date.now(),
        _timestamp: Date.now(),
        _type: 'oauth-success'
      });

      console.log('[Shopify OAuth] Stored result for polling:', oauthResultKey);

      // Clean up the original state
      oauthStates.delete(state as string);

      // Send HTML response that closes popup and notifies parent
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            p {
              margin: 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Successfully Connected!</h1>
            <p>This window will close automatically...</p>
            <div id="debug-info" style="margin-top: 20px; font-size: 12px; opacity: 0.8;"></div>
          </div>
          <script>
            console.log('OAuth successful, storing data in localStorage');
            // Use localStorage for cross-origin communication
            const oauthKey = 'shopify-oauth-success-' + Date.now();
            const resultData = {
              type: 'oauth-success',
              storeData: ${JSON.stringify(storeData)},
              timestamp: Date.now()
            };

            // Show debug info
            const debugDiv = document.getElementById('debug-info');
            debugDiv.innerHTML = 'Store data: ' + JSON.stringify(resultData, null, 2);

            // Store in localStorage for parent to pick up
            localStorage.setItem(oauthKey, JSON.stringify(resultData));
            localStorage.setItem('shopify-oauth-latest', JSON.stringify(resultData));
            console.log('Stored in localStorage:', oauthKey);
            console.log('Data:', resultData);

            // Close the window after 3 seconds
            setTimeout(() => {
              console.log('Closing popup now...');
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Shopify OAuth callback error:', error);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            p {
              margin: 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Authentication Failed</h1>
            <p>Please try again</p>
          </div>
          <script>
            window.opener.postMessage({
              type: 'oauth-error',
              error: 'Authentication failed'
            }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
    }
  }

  // WooCommerce OAuth (with plugin)
  initiateWooCommerceOAuth(req: Request, res: Response): void {
    const { storeUrl, storeName } = req.query;

    if (!storeUrl || typeof storeUrl !== 'string') {
      res.status(400).json({ error: 'Store URL is required' });
      return;
    }

    const state = crypto.randomBytes(32).toString('hex');

    oauthStates.set(state, {
      storeName: (storeName as string) || 'WooCommerce Store',
      storeUrl: storeUrl.toString(),
      platform: 'woocommerce',
      timestamp: Date.now()
    });

    // Get OAuth credentials from environment
    const clientId = process.env.WOOCOMMERCE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.WOOCOMMERCE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('WooCommerce OAuth credentials missing from environment');
      res.status(500).json({
        error: 'WooCommerce OAuth credentials not configured',
        message: 'Backend OAuth credentials not configured. Please add WOOCOMMERCE_OAUTH_CLIENT_ID and WOOCOMMERCE_OAUTH_CLIENT_SECRET to the backend .env file and restart the server.',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      });
      return;
    }

    // Build OAuth authorization URL for WooCommerce
    const baseUrl = storeUrl.toString().replace(/\/$/, '');
    const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/oauth/woocommerce/callback`;

    const authUrl = new URL(`${baseUrl}/wp-json/price-sync-oauth/v1/authorize`);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('store_name', (storeName as string) || 'WooCommerce Store');

    console.log('WooCommerce OAuth initiated:', {
      baseUrl,
      clientId: clientId.substring(0, 8) + '...',
      state: state.substring(0, 8) + '...'
    });

    res.json({
      authUrl: authUrl.toString(),
      state
    });
  }

  async handleWooCommerceCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query;

    if (!state) {
      res.status(400).json({ error: 'Missing state parameter' });
      return;
    }

    const storedState = oauthStates.get(state as string);
    if (!storedState || storedState.platform !== 'woocommerce') {
      res.status(400).json({ error: 'Invalid state' });
      return;
    }

    // Handle error
    if (error) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            p {
              margin: 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Authentication Failed</h1>
            <p>${error}</p>
          </div>
          <script>
            window.opener.postMessage({
              type: 'oauth-error',
              error: '${error}'
            }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    try {
      // Exchange code for access token and API keys
      const baseUrl = storedState.storeUrl.replace(/\/$/, '');
      const clientId = process.env.WOOCOMMERCE_OAUTH_CLIENT_ID!;
      const clientSecret = process.env.WOOCOMMERCE_OAUTH_CLIENT_SECRET!;
      const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/oauth/woocommerce/callback`;

      const tokenResponse = await fetch(`${baseUrl}/wp-json/price-sync-oauth/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json() as any;

      // Create store data
      const storeData = {
        storeId: storedState.storeName.toLowerCase().replace(/\s+/g, '-'),
        storeName: storedState.storeName,
        platform: 'woocommerce' as const,
        url: storedState.storeUrl,
        consumerKey: tokenData.consumer_key,
        consumerSecret: tokenData.consumer_secret,
        syncInterval: 60,
        enabled: true
      };

      // Clean up state
      oauthStates.delete(state as string);

      // Send success response
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            p {
              margin: 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Successfully Connected!</h1>
            <p>This window will close automatically...</p>
          </div>
          <script>
            window.opener.postMessage({
              type: 'oauth-success',
              storeData: ${JSON.stringify(storeData)}
            }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('WooCommerce OAuth callback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            p {
              margin: 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Authentication Failed</h1>
            <p>${errorMessage}</p>
          </div>
          <script>
            window.opener.postMessage({
              type: 'oauth-error',
              error: '${errorMessage}'
            }, '*');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
    }
  }

  // Token-based WooCommerce connection (simplified plugin approach)
  async connectWooCommerce(req: Request, res: Response): Promise<void> {
    const { token, consumer_key, consumer_secret, site_url, store_name, platform } = req.body;

    // Validate required fields
    if (!token || !consumer_key || !consumer_secret || !site_url) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['token', 'consumer_key', 'consumer_secret', 'site_url']
      });
      return;
    }

    if (platform !== 'woocommerce') {
      res.status(400).json({ error: 'Invalid platform' });
      return;
    }

    try {
      // Verify token exists and is valid
      const tokenData = oauthStates.get(token);
      if (!tokenData || tokenData.platform !== 'woocommerce') {
        res.status(401).json({ error: 'Invalid or expired connection token' });
        return;
      }

      // Verify site URL matches what we initiated
      const normalizedSiteUrl = site_url.replace(/\/$/, '');
      const normalizedStoreUrl = tokenData.storeUrl.replace(/\/$/, '');

      if (normalizedSiteUrl !== normalizedStoreUrl) {
        res.status(400).json({
          error: 'Site URL mismatch',
          expected: tokenData.storeUrl,
          received: site_url
        });
        return;
      }

      // Create store data with credentials
      const storeData = {
        storeId: tokenData.storeName.toLowerCase().replace(/\s+/g, '-'),
        storeName: store_name || tokenData.storeName,
        platform: 'woocommerce' as const,
        url: site_url,
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        syncInterval: 60,
        enabled: true
      };

      console.log('WooCommerce store connected:', {
        storeId: storeData.storeId,
        storeName: storeData.storeName,
        url: storeData.url
      });

      // Clean up token
      oauthStates.delete(token);

      // Return success with redirect URL
      res.json({
        success: true,
        message: 'Store connected successfully',
        redirect_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/dashboard`,
        storeData
      });
    } catch (error) {
      console.error('WooCommerce connection error:', error);
      res.status(500).json({
        error: 'Connection failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Generate connection token for WooCommerce
  generateConnectionToken(req: Request, res: Response): void {
    const { storeUrl, storeName } = req.query;

    if (!storeUrl || typeof storeUrl !== 'string') {
      res.status(400).json({ error: 'Store URL is required' });
      return;
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Store token with metadata
    oauthStates.set(token, {
      storeName: (storeName as string) || 'WooCommerce Store',
      storeUrl: storeUrl.toString(),
      platform: 'woocommerce',
      timestamp: Date.now()
    });

    // Clean up old tokens (older than 15 minutes)
    const now = Date.now();
    for (const [key, value] of oauthStates.entries()) {
      if (now - value.timestamp > 900000) {
        oauthStates.delete(key);
      }
    }

    console.log('Connection token generated:', {
      token: token.substring(0, 8) + '...',
      storeUrl,
      storeName
    });

    // Return token and WordPress admin URL
    const baseUrl = storeUrl.replace(/\/$/, '');
    const wpAdminUrl = `${baseUrl}/wp-admin/admin.php?page=price-sync-connector&token=${token}`;

    res.json({
      token,
      wpAdminUrl
    });
  }

  // Poll for Shopify OAuth result
  pollShopifyOAuthResult(req: Request, res: Response): void {
    const { state } = req.query;

    if (!state || typeof state !== 'string') {
      res.status(400).json({ error: 'State parameter required' });
      return;
    }

    const oauthResultKey = `shopify-result-${state}`;
    const result = oauthStates.get(oauthResultKey);

    if (!result) {
      res.json({ ready: false });
      return;
    }

    // Check if result is too old (older than 30 seconds)
    if (Date.now() - (result as any)._timestamp > 30000) {
      oauthStates.delete(oauthResultKey);
      res.json({ ready: false, expired: true });
      return;
    }

    // Return the result and clean up
    oauthStates.delete(oauthResultKey);
    const { _timestamp, _type, ...storeData } = result as any;

    console.log('[Shopify OAuth] Returning result for polling:', storeData);
    res.json({ ready: true, storeData });
  }
}
