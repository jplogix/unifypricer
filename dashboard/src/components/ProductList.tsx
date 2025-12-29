import React from 'react';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ProductListProps {
    storeId: string;
}

const ProductList: React.FC<ProductListProps> = ({ storeId }) => {
    const { products, loading } = useStoreProducts(storeId);

    if (loading) {
        return <div className="text-center py-4 text-gray-500">Loading products...</div>;
    }

    if (products.length === 0) {
        return <div className="text-center py-4 text-gray-500">No products synced yet.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                        <tr key={product.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {product.platformProductId}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {product.sku || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.status === 'repriced' ? 'bg-green-100 text-green-800' :
                                    product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {product.status === 'repriced' && <CheckCircle className="w-3 h-3 mr-1" />}
                                    {product.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                    {product.status === 'unlisted' && <AlertCircle className="w-3 h-3 mr-1" />}
                                    {product.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {product.currentPrice ? `$${product.currentPrice.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(product.lastAttempt).toLocaleTimeString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ProductList;
