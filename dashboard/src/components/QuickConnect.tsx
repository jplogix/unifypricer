import { Check, ExternalLink, Eye, EyeOff, Info, Loader2, Plug, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { InputWithHistory } from './InputWithHistory';
import OAuthConnect from './OAuthConnect';

interface QuickConnectProps {
  onConnect: (storeData: {
    storeId: string;
    storeName: string;
    platform: 'woocommerce' | 'shopify';
    url: string;
    credentials: any;
  }) => Promise<void>;
  onCancel: () => void;
}

const QuickConnect: React.FC<QuickConnectProps> = ({ onConnect, onCancel }) => {
  const [step, setStep] = useState<'platform' | 'url' | 'oauth' | 'credentials'>('platform');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // URL step state
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<'woocommerce' | 'shopify' | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'woocommerce' | 'shopify' | null>(null);

  // Credentials step state
  const [credentials, setCredentials] = useState({
    consumerKey: '',
    consumerSecret: '',
    accessToken: ''
  });
  const [showSecret, setShowSecret] = useState(false);

  const detectPlatform = (url: string): 'woocommerce' | 'shopify' | null => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('myshopify.com') || lowerUrl.includes('.shopify.com')) {
      return 'shopify';
    }
    if (lowerUrl.includes('wp-admin') || lowerUrl.includes('wc-api') || lowerUrl.includes('woocommerce')) {
      return 'woocommerce';
    }
    return null; // Can't detect, let user choose
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!storeName.trim() || !storeUrl.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Format URL
      let formattedUrl = storeUrl.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      // Detect platform
      const platform = detectPlatform(formattedUrl);
      setDetectedPlatform(platform);

      // Simulate validation delay
      await new Promise(resolve => setTimeout(resolve, 800));

      setStoreUrl(formattedUrl);
      setStep('oauth');
    } catch (err) {
      setError('Failed to validate store URL. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const platform = detectedPlatform || 'woocommerce'; // Default to WooCommerce if not detected
      const storeId = storeName.toLowerCase().replace(/\s+/g, '-');

      const payload: any = {
        storeId,
        storeName,
        platform,
        url: storeUrl,
        credentials: {}
      };

      if (platform === 'woocommerce') {
        if (!credentials.consumerKey || !credentials.consumerSecret) {
          setError('Please enter both Consumer Key and Secret');
          setIsLoading(false);
          return;
        }
        payload.credentials = {
          url: storeUrl,
          consumerKey: credentials.consumerKey,
          consumerSecret: credentials.consumerSecret
        };
      } else {
        if (!credentials.accessToken) {
          setError('Please enter your Access Token');
          setIsLoading(false);
          return;
        }
        payload.credentials = {
          shopDomain: storeUrl,
          accessToken: credentials.accessToken
        };
      }

      await onConnect(payload);
    } catch (err: any) {
      setError(err.message || 'Failed to connect store. Please try again.');
      setIsLoading(false);
    }
  };

  const platform = detectedPlatform || selectedPlatform || 'woocommerce';
  const platformIcon = platform === 'woocommerce' ? 'WooCommerce' : 'Shopify';
  const platformColor = platform === 'woocommerce' ? 'text-purple-600 bg-purple-100' : 'text-green-600 bg-green-100';

  const handlePlatformSelect = (platform: 'woocommerce' | 'shopify') => {
    setSelectedPlatform(platform);
    setStep('url');
  };

  if (step === 'platform') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Choose Your Platform</h2>
            <button onClick={onCancel}
              type='button'
              className="text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-gray-600 mb-6">Select the e-commerce platform you want to connect:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* WooCommerce Card */}
              <button
                type="button"
                onClick={() => handlePlatformSelect('woocommerce')}
                className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
              >
                <div className="w-32 h-32 mb-4 flex items-center justify-center">
                  <img
                    src="/woocommerce-logo-2048x2048.png"
                    alt="WooCommerce"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">WooCommerce</h3>
                <p className="text-sm text-gray-600 text-center">
                  Self-hosted e-commerce platform built on WordPress
                </p>
              </button>

              {/* Shopify Card */}
              <button
                type="button"
                onClick={() => handlePlatformSelect('shopify')}
                className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all duration-200 group"
              >
                <div className="w-40 h-24 mb-4 flex items-center justify-center">
                  <img
                    src="/Shopify-Logo-1024x640.png"
                    alt="Shopify"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Shopify</h3>
                <p className="text-sm text-gray-600 text-center">
                  Cloud-based e-commerce platform with hosted stores
                </p>
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Not sure?</strong> You can add multiple stores of different platforms later.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'oauth') {
    return (
      <OAuthConnect
        storeName={storeName}
        storeUrl={storeUrl}
        platform={detectedPlatform || selectedPlatform || 'woocommerce'}
        onConnect={async (storeData) => {
          const payload = {
            storeId: storeData.storeId,
            storeName: storeData.storeName,
            platform: storeData.platform,
            url: storeData.url || storeData.shopDomain,
            credentials: storeData
          };
          await onConnect(payload);
        }}
        onCancel={() => setStep('url')}
      />
    );
  }

  if (step === 'credentials') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${platformColor} flex items-center justify-center`}>
                  <Plug className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{storeName}</h2>
                  <p className="text-sm text-gray-500">{storeUrl}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('url')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Change
              </button>
            </div>
          </div>

          <form onSubmit={handleCredentialsSubmit} className="p-6 space-y-4">
            {platform === 'woocommerce' ? (
              <>
                <InputWithHistory
                  label="Consumer Key"
                  value={credentials.consumerKey}
                  onChange={(value) => setCredentials({ ...credentials, consumerKey: value })}
                  placeholder="ck_xxxxxxxx"
                  storageKey="woocommerce-consumer-key"
                  helpText="WooCommerce → Settings → Advanced → REST API"
                  disabled={isLoading}
                  required
                />

                <div>
                  <label htmlFor="consumer-secret" className="block text-sm font-medium text-gray-700 mb-1">
                    Consumer Secret
                  </label>
                  <div className="relative">
                    <input
                      id="consumer-secret"
                      type={showSecret ? 'text' : 'password'}
                      value={credentials.consumerSecret}
                      onChange={(e) => setCredentials({ ...credentials, consumerSecret: e.target.value })}
                      placeholder="cs_xxxxxxxx"
                      className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showSecret ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="access-token" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin API Access Token
                </label>
                <input
                  id="access-token"
                  type="password"
                  value={credentials.accessToken}
                  onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                  placeholder="shpat_xxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  disabled={isLoading}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Shopify Admin → Apps → Manage apps → Develop apps
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                These credentials allow us to securely sync your product prices.
              </p>
            </div>

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
          <h2 className="text-xl font-semibold text-gray-900">Connect Your Store</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter your store details to get started
          </p>
        </div>

        <form onSubmit={handleUrlSubmit} className="p-6 space-y-4">
          <InputWithHistory
            label="Store Name"
            value={storeName}
            onChange={setStoreName}
            placeholder="My Store"
            storageKey="quickconnect-store-name"
            disabled={isLoading}
            required
          />

          <InputWithHistory
            label="Store URL"
            type="url"
            value={storeUrl}
            onChange={(value) => {
              setStoreUrl(value);
              const platform = detectPlatform(value);
              setDetectedPlatform(platform);
            }}
            placeholder="https://mystore.com"
            storageKey="quickconnect-store-url"
            disabled={isLoading}
            required
          />

          {detectedPlatform && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${platformColor}`}>
              <Check className="w-3 h-3" />
              {platformIcon} detected
            </div>
          )}

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
                  Validating...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Connect Store
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickConnect;
