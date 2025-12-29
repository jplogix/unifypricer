import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import type { StoreConfig } from '../types';
import { storeService } from '../services/api';

interface StoreConfigurationProps {
    initialConfig?: StoreConfig;
    selectedPlatform?: 'woocommerce' | 'shopify';
    pendingStoreName?: string;
    pendingStoreUrl?: string;
    onCancel: () => void;
    onSave: () => void;
}

const StoreConfiguration: React.FC<StoreConfigurationProps> = ({
    initialConfig,
    selectedPlatform,
    pendingStoreName,
    pendingStoreUrl,
    onCancel,
    onSave
}) => {
    const [formData, setFormData] = useState({
        storeId: '',
        storeName: pendingStoreName || '',
        platform: selectedPlatform || ('woocommerce' as 'woocommerce' | 'shopify'),
        credentials: {
            url: pendingStoreUrl || '',
            consumerKey: '',
            consumerSecret: '',
            shopDomain: pendingStoreUrl || '',
            accessToken: ''
        },
        syncInterval: 60
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialConfig) {
            setFormData({
                storeId: initialConfig.storeId,
                storeName: initialConfig.storeName,
                platform: initialConfig.platform,
                credentials: {
                    url: (initialConfig as any).credentials?.url || '',
                    consumerKey: (initialConfig as any).credentials?.consumerKey || '',
                    consumerSecret: (initialConfig as any).credentials?.consumerSecret || '',
                    shopDomain: (initialConfig as any).credentials?.shopDomain || '',
                    accessToken: (initialConfig as any).credentials?.accessToken || ''
                },
                syncInterval: initialConfig.syncInterval
            });
        } else if (selectedPlatform) {
            setFormData(prev => ({
                ...prev,
                platform: selectedPlatform,
                storeName: pendingStoreName || prev.storeName,
                credentials: {
                    ...prev.credentials,
                    url: selectedPlatform === 'woocommerce' ? (pendingStoreUrl || prev.credentials.url) : '',
                    shopDomain: selectedPlatform === 'shopify' ? (pendingStoreUrl || prev.credentials.shopDomain) : ''
                }
            }));
        }
    }, [initialConfig, selectedPlatform, pendingStoreName, pendingStoreUrl]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name in formData.credentials) {
            setFormData(prev => ({
                ...prev,
                credentials: { ...prev.credentials, [name]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Prepare payload based on platform
            const payload: any = {
                storeId: formData.storeId,
                storeName: formData.storeName,
                platform: formData.platform,
                syncInterval: Number(formData.syncInterval),
                enabled: true,
                credentials: {}
            };

            if (formData.platform === 'woocommerce') {
                payload.credentials = {
                    url: formData.credentials.url,
                    consumerKey: formData.credentials.consumerKey,
                    consumerSecret: formData.credentials.consumerSecret
                };
            } else {
                payload.credentials = {
                    shopDomain: formData.credentials.shopDomain,
                    accessToken: formData.credentials.accessToken
                };
            }

            await storeService.create(payload);
            onSave();
        } catch (error) {
            console.error('Failed to save store:', error);
            alert('Failed to save store configuration');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {initialConfig ? 'Edit Store' : 'Add New Store'}
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Store ID</label>
                        <input
                            type="text"
                            name="storeId"
                            required
                            readOnly={!!initialConfig}
                            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border ${initialConfig ? 'bg-gray-100' : ''}`}
                            value={formData.storeId}
                            onChange={handleChange}
                            placeholder="e.g., my-store-1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Store Name</label>
                        <input
                            type="text"
                            name="storeName"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            value={formData.storeName}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Platform</label>
                        <select
                            name="platform"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            value={formData.platform}
                            onChange={handleChange}
                            disabled={!!initialConfig || !!selectedPlatform}
                        >
                            <option value="woocommerce">WooCommerce</option>
                            <option value="shopify">Shopify</option>
                        </select>
                        {selectedPlatform && !initialConfig && (
                            <p className="mt-1 text-sm text-gray-500">
                                Platform pre-selected based on your choice
                            </p>
                        )}
                    </div>

                    {formData.platform === 'woocommerce' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Store URL</label>
                                <input
                                    type="url"
                                    name="url"
                                    required
                                    placeholder="https://example.com"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    value={formData.credentials.url}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Consumer Key</label>
                                <input
                                    type="text"
                                    name="consumerKey"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    value={formData.credentials.consumerKey}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Consumer Secret</label>
                                <input
                                    type="password"
                                    name="consumerSecret"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    value={formData.credentials.consumerSecret}
                                    onChange={handleChange}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Shop Domain</label>
                                <input
                                    type="text"
                                    name="shopDomain"
                                    required
                                    placeholder="shop.myshopify.com"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    value={formData.credentials.shopDomain}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Access Token</label>
                                <input
                                    type="password"
                                    name="accessToken"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                    value={formData.credentials.accessToken}
                                    onChange={handleChange}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Sync Interval (minutes)</label>
                        <input
                            type="number"
                            name="syncInterval"
                            min="1"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            value={formData.syncInterval}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {loading ? 'Saving...' : 'Save Store'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StoreConfiguration;
