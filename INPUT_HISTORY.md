# Input History Feature

## Overview

The dashboard now remembers previously entered values for input fields, making it faster to reconnect stores or enter similar information.

## Features

✅ **Automatic History Tracking** - Values are saved when you move away from an input
✅ **Smart Suggestions** - Dropdown shows relevant past values as you type
✅ **Keyboard Navigation** - Use arrow keys to navigate, Enter to select, Escape to close
✅ **Remove Individual Items** - Hover over suggestions to remove unwanted entries
✅ **Persistent Storage** - History survives page refreshes and browser restarts
✅ **Configurable Limits** - Each input can have its own max history items (default: 10)

## Usage

### QuickConnect Form

When adding a new store, the following fields remember history:

1. **Store Name** - Remembers previous store names you've entered
2. **Store URL** - Remembers previous store URLs
3. **Consumer Key** (WooCommerce) - Remembers previous API consumer keys

### How to Use

1. **Start typing** - Suggestions appear automatically
2. **Click a suggestion** - Fills the input instantly
3. **Arrow keys** - Navigate through suggestions
4. **Enter** - Select highlighted suggestion
5. **Escape** - Close suggestions
6. **X button** - Remove unwanted history item

### Visual Indicators

- 🕒 **Clock icon** - Appears when history is available
- **Dropdown** - Shows matching suggestions below the input
- **Highlight** - Selected suggestion is highlighted in blue

## Storage

History is stored in browser's localStorage with these keys:

- `quickconnect-store-name` - Store names
- `quickconnect-store-url` - Store URLs  
- `woocommerce-consumer-key` - WooCommerce API keys

## Privacy & Security

- **Local only** - History never leaves your browser
- **Per browser** - Each browser has its own history
- **Manually removable** - You can delete individual items
- **Automatic limits** - Old entries are removed when limit is reached
- **Sensitive data** - Password fields don't have history for security

## Components

### `InputWithHistory`

Reusable component for any input that needs history:

```tsx
<InputWithHistory
  label="Store Name"
  value={storeName}
  onChange={setStoreName}
  placeholder="My Store"
  storageKey="my-unique-key"
  maxHistoryItems={10}
  required
/>
```

### `useInputHistory`

Custom hook for managing input history:

```tsx
const {
  history,
  addToHistory,
  getSuggestions,
  removeFromHistory,
  clearHistory
} = useInputHistory({
  storageKey: 'my-key',
  maxItems: 10
});
```

## Future Enhancements

Potential improvements:

- [ ] Import/export history
- [ ] Sync across devices
- [ ] Fuzzy search in suggestions
- [ ] Category-based history
- [ ] Frequency-based sorting
- [ ] Time-based expiration

## Technical Details

### Implementation

- **Location**: `dashboard/src/components/InputWithHistory.tsx`
- **Hook**: `dashboard/src/hooks/useInputHistory.ts`
- **Storage**: Browser localStorage
- **State Management**: React hooks

### Key Features

- Click outside detection
- Keyboard navigation
- Duplicate prevention
- Automatic trimming
- Case-insensitive filtering
- LRU eviction (Least Recently Used)
