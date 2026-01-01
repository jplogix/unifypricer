import { Clock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useInputHistory } from '../hooks/useInputHistory';

interface InputWithHistoryProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    storageKey: string;
    maxHistoryItems?: number;
    label?: string;
    helpText?: string;
}

export function InputWithHistory({
    value,
    onChange,
    onBlur,
    placeholder,
    type = 'text',
    disabled,
    required,
    className = '',
    storageKey,
    maxHistoryItems = 10,
    label,
    helpText,
}: InputWithHistoryProps) {
    const [isFocused, setIsFocused] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const {
        showSuggestions,
        setShowSuggestions,
        addToHistory,
        getSuggestions,
        removeFromHistory,
    } = useInputHistory({
        storageKey,
        maxItems: maxHistoryItems,
    });

    const suggestions = getSuggestions(value);
    const showDropdown = isFocused && showSuggestions && suggestions.length > 0;

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                inputRef.current &&
                !inputRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setShowSuggestions]);

    const handleFocus = () => {
        setIsFocused(true);
        setShowSuggestions(true);
        setSelectedIndex(-1);
    };

    const handleBlur = () => {
        // Delay to allow click on suggestions
        setTimeout(() => {
            if (!dropdownRef.current?.matches(':hover')) {
                setIsFocused(false);
                setShowSuggestions(false);
                if (value) {
                    addToHistory(value);
                }
                onBlur?.();
            }
        }, 200);
    };

    const handleChange = (newValue: string) => {
        onChange(newValue);
        setShowSuggestions(true);
        setSelectedIndex(-1);
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
        setShowSuggestions(false);
        setIsFocused(false);
        inputRef.current?.blur();
    };

    const handleRemoveSuggestion = (e: React.MouseEvent, suggestion: string) => {
        e.stopPropagation();
        removeFromHistory(suggestion);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showDropdown) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    e.preventDefault();
                    handleSuggestionClick(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };

    return (
        <div className="relative">
            {label && (
                <label htmlFor="input-with-history" className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                <input
                    id="input-with-history"
                    ref={inputRef}
                    type={type}
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 ${className}`}
                />

                {isFocused && suggestions.length > 0 && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                )}
            </div>

            {helpText && (
                <p className="mt-1 text-xs text-gray-500">{helpText}</p>
            )}

            {/* Suggestions Dropdown */}
            {showDropdown && (
                <div
                    ref={dropdownRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                    <div className="py-1">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={suggestion}
                                onClick={() => handleSuggestionClick(suggestion)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleSuggestionClick(suggestion);
                                    }
                                }}
                                type="button"
                                className={`w-full text-left px-3 py-2 cursor-pointer flex items-center justify-between group ${index === selectedIndex
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="truncate text-sm">{suggestion}</span>
                                </div>
                                <button
                                    onClick={(e) => handleRemoveSuggestion(e, suggestion)}
                                    type="button"
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                                    title="Remove from history"
                                >
                                    <X className="w-3 h-3 text-gray-500" />
                                </button>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
