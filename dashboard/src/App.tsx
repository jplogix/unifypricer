import { LayoutDashboard, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import QuickConnect from './components/QuickConnect';
import { ServerLogs } from './components/ServerLogs';
import StoreCard from './components/StoreCard';
import StoreConfiguration from './components/StoreConfiguration';
import { SyncStatusBar } from './components/SyncStatusBar';
import { ToastContainer } from './components/ToastContainer';
import { useStoreStatus } from './hooks/useStoreStatus';
import { useStores } from './hooks/useStores';
import { useToast } from './hooks/useToast';
import { storeService } from './services/api';
import type { StoreConfig } from './types';

type ConfigStep = 'quickconnect' | 'form' | null;

function App() {
  const { stores, loading, error, refreshStores } = useStores();
  const { toasts, removeToast, success, error: showError, info } = useToast();
  const [configStep, setConfigStep] = useState<ConfigStep>(null);
  const [selectedStore, setSelectedStore] = useState<StoreConfig | undefined>(undefined);
  const [syncingStoreId, setSyncingStoreId] = useState<string | null>(null);

  // Monitor status of currently syncing store
  const syncStatus = useStoreStatus(syncingStoreId || '');

  const handleAddStore = () => {
    setSelectedStore(undefined);
    setConfigStep('quickconnect');
  };

  const handleQuickConnect = async (storeData: {
    storeId: string;
    storeName: string;
    platform: 'woocommerce' | 'shopify';
    url: string;
    credentials: string;
  }) => {
    try {
      info(`Creating store ${storeData.storeName}...`);

      type StorePayload = {
        storeId: string;
        storeName: string;
        platform: 'woocommerce' | 'shopify';
        syncInterval: number;
        url: string;
        enabled: boolean;
        credentials: unknown | any;
      };

      const payload: StorePayload = {
        storeId: storeData.storeId,
        storeName: storeData.storeName,
        platform: storeData.platform,
        syncInterval: 60,
        enabled: true,
        credentials: storeData.credentials,
        url: ''
      };

      await storeService.create(payload);
      success(`Store ${storeData.storeName} created successfully!`);

      await refreshStores();
      setConfigStep(null);

      // Start monitoring sync
      setSyncingStoreId(storeData.storeId);
      info(`Starting price sync for ${storeData.storeName}...`);

      try {
        await storeService.triggerSync(storeData.storeId);
      } catch (err) {
        showError(`Failed to start sync for ${storeData.storeName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } catch (err) {
      showError(`Failed to create store: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditStore = async (store: StoreConfig) => {
    try {
      // Fetch the full store config with credentials from the server
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/stores/${store.storeId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch store details');
      }

      const storeWithCredentials = await response.json();
      setSelectedStore(storeWithCredentials);
      setConfigStep('form');
    } catch (error) {
      logger.error('Failed to fetch store for editing:', error);
      showError('Failed to load store details. Please try again.');
    }
  };

  const handleConfigSave = async () => {
    await refreshStores();
    setConfigStep(null);
  };

  const handleConfigCancel = () => {
    setConfigStep(null);
    setSelectedStore(undefined);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Price Sync Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                type='button'
                onClick={refreshStores}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Refresh Stores"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type='button'
                onClick={handleAddStore}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Store
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Server Logs */}
        <div className="mb-6">
          <ServerLogs maxHeight="400px" />
        </div>

        {/* Sync Status Bar */}
        {syncingStoreId && syncStatus.status && (
          <SyncStatusBar
            storeName={stores.find(s => s.storeId === syncingStoreId)?.storeName || syncingStoreId}
            status={(syncStatus.status.syncStatus === 'pending' ? 'in_progress' : syncStatus.status.syncStatus) as 'in_progress' | 'success' | 'partial' | 'failed'}
            repricedCount={syncStatus.status.repricedCount}
            pendingCount={syncStatus.status.pendingCount}
            unlistedCount={syncStatus.status.unlistedCount}
            error={syncStatus.error || undefined}
          />
        )}

        {loading && stores.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12">
            <LayoutDashboard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No stores configured</h3>
            <p className="mt-1 text-gray-500">Get started by adding your first store.</p>
            <button
              type="button"
              onClick={handleAddStore}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Store
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {stores.map((store) => (
              <StoreCard
                key={store.storeId}
                store={store}
                onEdit={() => handleEditStore(store)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Quick Connect Modal */}
      {configStep === 'quickconnect' && (
        <QuickConnect
          onConnect={handleQuickConnect}
          onCancel={handleConfigCancel}
        />
      )}

      {/* Configuration Modal (for editing existing stores) */}
      {configStep === 'form' && selectedStore && (
        <StoreConfiguration
          initialConfig={selectedStore}
          onSave={handleConfigSave}
          onCancel={handleConfigCancel}
        />
      )}
    </div>
  );
}


export default App;


