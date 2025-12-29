import { useState } from 'react';
import { LayoutDashboard, Plus, RefreshCw, ShoppingBag } from 'lucide-react';
import StoreCard from './components/StoreCard';
import StoreConfiguration from './components/StoreConfiguration';
import QuickConnect from './components/QuickConnect';
import { storeService } from './services/api';
import type { StoreConfig } from './types';
import { useStores } from './hooks/useStores';

type ConfigStep = 'quickconnect' | 'form' | null;

function App() {
  const { stores, loading, error, refreshStores } = useStores();
  const [configStep, setConfigStep] = useState<ConfigStep>(null);
  const [selectedStore, setSelectedStore] = useState<StoreConfig | undefined>(undefined);

  const handleAddStore = () => {
    setSelectedStore(undefined);
    setConfigStep('quickconnect');
  };

  const handleQuickConnect = async (storeData: {
    storeId: string;
    storeName: string;
    platform: 'woocommerce' | 'shopify';
    url: string;
    credentials: any;
  }) => {
    const payload: any = {
      storeId: storeData.storeId,
      storeName: storeData.storeName,
      platform: storeData.platform,
      syncInterval: 60,
      enabled: true,
      credentials: storeData.credentials
    };

    await storeService.create(payload);
    await refreshStores();
    setConfigStep(null);
  };

  const handleEditStore = (store: StoreConfig) => {
    setSelectedStore(store);
    setConfigStep('form');
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
                onClick={refreshStores}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Refresh Stores"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
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


