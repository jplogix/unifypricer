import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Loader2, Check, AlertCircle } from 'lucide-react';
import { API_URL } from '../services/api';

interface OAuthConnectProps {
  storeName: string;
  storeUrl: string;
  platform: 'woocommerce' | 'shopify';
  onConnect: (storeData: any) => Promise<void>;
  onCancel: () => void;
}

const OAuthConnect: React.FC<OAuthConnectProps> = ({
  storeName,
  storeUrl,
  platform,
  onConnect,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const popupRef = useRef<Window | null>(null);
  const [oauthState, setOauthState] = useState<string | null>(null);

  useEffect(() => {
    // For Shopify, poll the backend for OAuth result
    if (platform !== 'shopify' || !oauthState) return;

    console.log('[Shopify OAuth] Setting up backend polling for state:', oauthState);

    const checkOAuthResult = async () => {
      try {
        const response = await fetch(`${API_URL}/oauth/shopify/poll?state=${oauthState}`);
        const data = await response.json();

        if (!data.ready) {
          if (data.expired) {
            console.log('[Shopify OAuth] OAuth expired');
            setError('Connection expired. Please try again.');
            setIsLoading(false);
          }
          return;
        }

        console.log('[Shopify OAuth] Got result from backend:', data.storeData);

        setStatus('Connection successful! Creating store...');
        await onConnect(data.storeData);
        console.log('[Shopify OAuth] Store created successfully');
        setStatus('');

        if (popupRef.current && !popupRef.current.closed) {
          console.log('[Shopify OAuth] Closing popup...');
          popupRef.current.close();
        }
      } catch (err) {
        console.error('[Shopify OAuth] Error polling for result:', err);
      }
    };

    // Poll immediately and then every 500ms
    console.log('[Shopify OAuth] Starting backend polling');
    checkOAuthResult(); // Check immediately
    const interval = setInterval(checkOAuthResult, 500);

    return () => {
      console.log('[Shopify OAuth] Cleaning up polling');
      clearInterval(interval);
    };
  }, [platform, oauthState, onConnect]);

  const handleOAuth = async () => {
    setIsLoading(true);
    setError('');
    setStatus('Initiating authentication...');

    try {
      // Use imported API_URL

      if (platform === 'shopify') {
        // Extract shop domain from URL
        let shopDomain = storeUrl;
        if (!shopDomain.includes('.myshopify.com')) {
          throw new Error('Invalid Shopify store URL. Must be in format: store.myshopify.com');
        }

        shopDomain = shopDomain.replace(/^https?:\/\//, '');

        const response = await fetch(
          `${API_URL}/oauth/shopify/initiate?shop=${shopDomain}&storeName=${encodeURIComponent(storeName)}`
        );

        if (!response.ok) {
          throw new Error('Failed to initiate OAuth');
        }

        const data = await response.json();

        // Save state for polling
        setOauthState(data.state);

        // Open popup for OAuth flow
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        popupRef.current = window.open(
          data.authUrl,
          'Shopify OAuth',
          `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`
        );

        if (!popupRef.current) {
          throw new Error('Popup was blocked. Please allow popups for this site.');
        }

        setStatus('Complete the authentication in the popup window...');
      } else {
        // WooCommerce simplified connection with plugin
        const response = await fetch(
          `${API_URL}/oauth/woocommerce/generate-token?storeUrl=${encodeURIComponent(storeUrl)}&storeName=${encodeURIComponent(storeName)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('WooCommerce token generation failed:', errorData);
          throw new Error(errorData.error || 'Failed to generate connection token');
        }

        const data = await response.json();

        // Open WordPress admin page in popup
        const width = 900;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        popupRef.current = window.open(
          data.wpAdminUrl,
          'WooCommerce Connector',
          `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`
        );

        if (!popupRef.current) {
          throw new Error('Popup was blocked. Please allow popups for this site.');
        }

        setStatus('Complete the connection in the popup window...');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate authentication');
      setIsLoading(false);
      setStatus('');
    }
  };

  const showManualCredentials = false;
  const [credentials, setCredentials] = useState({
    consumerKey: '',
    consumerSecret: ''
  });

  const handleManualCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const storeData = {
      storeId: storeName.toLowerCase().replace(/\s+/g, '-'),
      storeName,
      platform: 'woocommerce',
      url: storeUrl,
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      syncInterval: 60,
      enabled: true
    };

    try {
      await onConnect(storeData);
    } catch (err: any) {
      setError(err.message || 'Failed to connect store');
      setIsLoading(false);
    }
  };

  if (showManualCredentials) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Enter WooCommerce API Keys</h2>
            <p className="text-sm text-gray-500 mt-1">
              Create API keys in WooCommerce → Settings → Advanced → REST API
            </p>
          </div>

          <form onSubmit={handleManualCredentials} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consumer Key
              </label>
              <input
                type="text"
                value={credentials.consumerKey}
                onChange={(e) => setCredentials({ ...credentials, consumerKey: e.target.value })}
                placeholder="ck_xxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Consumer Secret
              </label>
              <input
                type="password"
                value={credentials.consumerSecret}
                onChange={(e) => setCredentials({ ...credentials, consumerSecret: e.target.value })}
                placeholder="cs_xxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                disabled={isLoading}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Connect Store
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${platform === 'woocommerce' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
              }`}>
              <ExternalLink className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Connect {platform === 'woocommerce' ? 'WooCommerce' : 'Shopify'} Store
              </h2>
              <p className="text-sm text-gray-500">{storeName}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <p className="text-sm text-gray-700">
              <strong>Store URL:</strong> {storeUrl}
            </p>
          </div>

          {status && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">{status}</p>
            </div>
          )}

          {platform === 'woocommerce' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Requirement:</strong> Your WooCommerce store must have the Price Sync Connector plugin installed. <a href="https://github.com/yourusername/price-sync-dashboard/tree/main/woocommerce-connector-plugin" target="_blank" rel="noopener noreferrer" className="underline">Get the plugin</a>.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <p className="text-xs text-blue-800">
              <strong>What happens next?</strong><br />
              {platform === 'shopify'
                ? 'A popup will open where you\'ll authorize this app to access your Shopify store.'
                : 'A popup will open to your WordPress admin where the connection will be completed automatically with step-by-step progress.'}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleOAuth}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Connect with {platform === 'shopify' ? 'Shopify' : 'WooCommerce'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuthConnect;
