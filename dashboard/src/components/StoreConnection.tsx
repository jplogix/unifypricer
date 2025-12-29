import React, { useState } from 'react';
import { Plug, Check, AlertCircle, Loader2 } from 'lucide-react';

interface StoreConnectionProps {
  platform: 'woocommerce' | 'shopify';
  onConnect: (storeName: string, storeUrl: string) => Promise<void>;
  onCancel: () => void;
}

const StoreConnection: React.FC<StoreConnectionProps> = ({ platform, onConnect, onCancel }) => {
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'credentials'>('input');

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!storeName.trim()) {
      setError('Please enter a store name');
      return;
    }

    if (!storeUrl.trim()) {
      setError('Please enter a store URL');
      return;
    }

    if (!validateUrl(storeUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    setIsConnecting(true);

    try {
      // Validate the store URL format
      const formattedUrl = storeUrl.startsWith('http') ? storeUrl : `https://${storeUrl}`;

      // For now, just move to credentials step
      // In a full implementation, this would ping the store to verify it's valid
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate validation

      // Call the parent's onConnect with the validated data
      onConnect(storeName, formattedUrl);
    } catch (err) {
      setError('Failed to connect to store. Please check the URL and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Connect {platform === 'woocommerce' ? 'WooCommerce' : 'Shopify'} Store
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter your store details to get started
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleConnect} className="p-6 space-y-4">
          {/* Store Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Name
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="My Store"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              disabled={isConnecting}
            />
            <p className="mt-1 text-xs text-gray-500">
              A friendly name to identify this store
            </p>
          </div>

          {/* Store URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store URL
            </label>
            <input
              type="url"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder={
                platform === 'woocommerce'
                  ? 'https://mystore.com'
                  : 'mystore.myshopify.com'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              disabled={isConnecting}
            />
            <p className="mt-1 text-xs text-gray-500">
              {platform === 'woocommerce'
                ? 'Your WooCommerce store URL'
                : 'Your Shopify store domain'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Next step:</strong> After connecting, you'll enter your API credentials to enable price syncing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isConnecting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  Connect
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreConnection;
