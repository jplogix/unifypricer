import React from 'react';
import { X } from 'lucide-react';

interface PlatformSelectionProps {
  onSelect: (platform: 'woocommerce' | 'shopify') => void;
  onCancel: () => void;
}

const PlatformSelection: React.FC<PlatformSelectionProps> = ({ onSelect, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Choose Your Platform</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">Select the e-commerce platform you want to connect:</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WooCommerce Card */}
            <button
              onClick={() => onSelect('woocommerce')}
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
              onClick={() => onSelect('shopify')}
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
};

export default PlatformSelection;
