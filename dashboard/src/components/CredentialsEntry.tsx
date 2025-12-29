import React, { useState } from 'react';
import { Key, Loader2, Check } from 'lucide-react';

interface CredentialsEntryProps {
  platform: 'woocommerce' | 'shopify';
  storeName: string;
  storeUrl: string;
  onConnect: (credentials: { consumerKey?: string; consumerSecret?: string; accessToken?: string }) => Promise<void>;
  onCancel: () => void;
}

const CredentialsEntry: React.FC<CredentialsEntryProps> = ({
  platform,
  storeName,
  storeUrl,
  onConnect,
  onCancel
}) => {
  const [credentials, setCredentials] = useState({
    consumerKey: '',
    consumerSecret: '',
    accessToken: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (platform === 'woocommerce') {
        if (!credentials.consumerKey || !credentials.consumerSecret) {
          setError('Please enter both Consumer Key and Secret');
          return;
        }
        await onConnect({
          consumerKey: credentials.consumerKey,
          consumerSecret: credentials.consumerSecret
        });
      } else {
        if (!credentials.accessToken) {
          setError('Please enter your Access Token');
          return;
        }
        await onConnect({
          accessToken: credentials.accessToken
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Connect {storeName}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {platform === 'woocommerce' ? 'WooCommerce' : 'Shopify'}
              </p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 break-all">
              <strong>Store:</strong> {storeUrl}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {platform === 'woocommerce' ? (
            <>
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
                <p className="mt-1 text-xs text-gray-500">
                  Found in WooCommerce → Settings → Advanced → REST API
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consumer Secret
                </label>
                <div className="relative">
                  <input
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin API Access Token
              </label>
              <input
                type="password"
                value={credentials.accessToken}
                onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                placeholder="shpat_xxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                disabled={isLoading}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Found in Shopify Admin → Apps → Manage apps → Develop apps
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Help Text */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Need help?</strong> These API credentials allow us to securely sync your product prices.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Back
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
                  Complete Connection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CredentialsEntry;
