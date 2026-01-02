import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useStoreProducts } from '../hooks/useStoreProducts';

interface ProductListProps {
    storeId: string;
}

const ProductList: React.FC<ProductListProps> = ({ storeId }) => {
    const { products, loading } = useStoreProducts(storeId);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Calculate pagination
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = useMemo(
        () => products.slice(startIndex, endIndex),
        [products, startIndex, endIndex]
    );

    // Reset to page 1 when products change significantly
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    if (loading) {
        return <div className="text-center py-4 text-gray-500">Loading products...</div>;
    }

    if (products.length === 0) {
        return <div className="text-center py-4 text-gray-500">No products synced yet.</div>;
    }

    return (
        <div>
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
                        {paginatedProducts.map((product) => (
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
                                    {typeof product.currentPrice === 'number' && Number.isFinite(product.currentPrice)
                                        ? `$${product.currentPrice.toFixed(2)}`
                                        : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(product.lastAttempt).toLocaleTimeString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {products.length > 0 && totalPages > 1 && (
                <div className="mt-4 px-4 py-3 bg-white border-t border-gray-200">
                    {/* Top row: Items per page and showing text */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <label htmlFor="items-per-page" className="text-xs font-medium text-gray-700 whitespace-nowrap">Per page:</label>
                            <select
                                id="items-per-page"
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-gray-300 rounded text-xs px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                            {startIndex + 1}-{Math.min(endIndex, products.length)} of {products.length}
                        </span>
                    </div>

                    {/* Bottom row: Navigation buttons */}
                    <div className="flex items-center justify-center gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="First"
                        >
                            ««
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5"
                        >
                            <ChevronLeft className="w-3 h-3" />
                            <span className="hidden xs:inline">Prev</span>
                        </button>
                        <span className="px-3 py-1 text-xs font-medium text-gray-900 bg-gray-100 border border-gray-300 rounded min-w-[80px] text-center">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5"
                        >
                            <span className="hidden xs:inline">Next</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Last"
                        >
                            »»
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductList;
