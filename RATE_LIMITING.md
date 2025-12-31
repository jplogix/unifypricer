# Rate Limiting Implementation

## Problem

Shopify API was returning rate limit errors:

```
Exceeded 2 calls per second for api client. Reduce request rates to resume uninterrupted service.
```

This caused sync failures for multiple products during bulk price updates.

## Solution

Implemented comprehensive rate limiting for both Shopify and WooCommerce clients with:

### 1. Request Throttling

**Shopify Client** ([src/clients/shopify.ts](src/clients/shopify.ts)):

- **Rate**: ~1.8 requests/second (550ms between requests)
- **Reason**: Shopify's limit is 2 calls/second, we stay safely below
- Tracks last request time and enforces minimum interval

**WooCommerce Client** ([src/clients/woocommerce.ts](src/clients/woocommerce.ts)):

- **Rate**: 10 requests/second (100ms between requests)
- **Reason**: WooCommerce is more flexible, but we still throttle to be respectful

### 2. Automatic Retry with Exponential Backoff (Shopify)

When a rate limit error occurs:

- **1st retry**: Wait 1 second
- **2nd retry**: Wait 2 seconds  
- **3rd retry**: Wait 4 seconds
- **Max retries**: 3 attempts before failing

Detection:

- HTTP 429 status code
- Error message contains: "rate limit", "exceeded", or "calls per second"

### 3. Implementation Details

#### Rate Limiting Method

```typescript
private async waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - this.lastRequestTime;
  
  if (timeSinceLastRequest < this.minRequestInterval) {
    const waitTime = this.minRequestInterval - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  this.lastRequestTime = Date.now();
}
```

#### Protected Operations

**Shopify:**

- ✅ Authentication test call
- ✅ Product listing (with pagination)
- ✅ Variant fetch (before update)
- ✅ Price update

**WooCommerce:**

- ✅ Authentication test call
- ✅ Product listing (with pagination)
- ✅ Product fetch (before update)
- ✅ Price update

## Impact on Sync Performance

### Before Rate Limiting

- **Risk**: Random failures during bulk operations
- **Behavior**: Fast but unstable
- **User Experience**: Inconsistent, requires manual retries

### After Rate Limiting

**Shopify (~1.8 req/sec):**

- 100 products × 2 calls each = 200 API calls
- Time: ~110 seconds (1.8 minutes)
- **Benefit**: Zero rate limit errors, reliable completion

**WooCommerce (10 req/sec):**

- 100 products × 2 calls each = 200 API calls
- Time: ~20 seconds
- **Benefit**: Respectful to server, prevents overload

## Configuration

Rate limits can be adjusted in the client classes:

```typescript
// Shopify - more conservative
private readonly minRequestInterval: number = 550; // ms

// WooCommerce - more permissive
private readonly minRequestInterval: number = 100; // ms
```

## Monitoring

Rate limit errors are logged with:

- Retry attempts
- Backoff times
- Final success/failure status

Example logs:

```
[Shopify] Rate limit hit, retrying in 1000ms (attempt 1/3)
[Shopify] Rate limit hit, retrying in 2000ms (attempt 2/3)
[Shopify] Updated product 7389450436702 variant 41757552869470 price to 29.99
```

## Future Enhancements

Potential improvements:

1. **Dynamic rate adjustment**: Learn from API response headers
2. **Per-store rate limits**: Different limits for different shops
3. **Request queuing**: Queue requests and process in batches
4. **Circuit breaker**: Temporarily pause sync if errors persist
5. **Rate limit analytics**: Track and report rate limit events

## Testing

To verify rate limiting:

1. **Monitor sync logs**: Watch for rate limit messages
2. **Check error rates**: Should drop to near zero
3. **Measure sync duration**: Will be slower but reliable
4. **Test with large catalogs**: Sync 500+ products to verify stability

## References

- [Shopify API Rate Limits](https://shopify.dev/api/usage/rate-limits)
- [WooCommerce API Guidelines](https://woocommerce.github.io/woocommerce-rest-api-docs/)
