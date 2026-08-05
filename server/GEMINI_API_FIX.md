# Gemini API 503 Error Fix

## Problem
The application was experiencing `503 Service Unavailable` errors when calling the Google Generative AI (Gemini) API. This error occurs when the API is experiencing high demand or temporary unavailability.

## Root Cause
The `/generate-from-pdf` endpoint in `server/src/routes/quizzes.js` was making direct API calls to Gemini without any:
- Retry mechanism
- Error handling for temporary failures
- Exponential backoff strategy
- User-friendly error messages

## Solution Implemented

### 1. Retry Logic with Exponential Backoff
Added a robust retry mechanism that:
- Retries up to 3 times (configurable via `MAX_RETRIES`)
- Uses exponential backoff: 1s → 2s → 4s (max 10s)
- Includes jitter to prevent thundering herd problem
- Only retries on specific error types (503, 429, 500, 502, 504, network errors)

### 2. Smart Error Detection
The `isRetryableError()` function identifies retryable errors:
- **503 Service Unavailable** - Temporary service overload
- **429 Too Many Requests** - Rate limiting
- **500/502/504** - Server errors
- **Network errors** - ECONNRESET, ETIMEDOUT, ENOTFOUND

Non-retryable errors (like 400 Bad Request) fail immediately without wasting retries.

### 3. User-Friendly Error Messages
Enhanced error responses with clear messages:
- 503 errors: "The AI service is currently experiencing high demand. Please try again in a few moments."
- 429 errors: "Too many requests. Please wait a moment and try again."

### 4. Configuration Constants
Easy to adjust behavior via constants:
```javascript
const MAX_RETRIES = 3;           // Number of retry attempts
const INITIAL_RETRY_DELAY = 1000; // Starting delay (1 second)
const MAX_RETRY_DELAY = 10000;    // Maximum delay (10 seconds)
```

## Files Modified

### `server/src/routes/quizzes.js`
- Added retry helper functions (`sleep`, `calculateRetryDelay`, `isRetryableError`, `executeWithRetry`)
- Wrapped Gemini API call in `executeWithRetry()` 
- Enhanced error handling with user-friendly messages
- Added comprehensive logging for debugging

### `server/test-retry-logic.js` (New)
- Test suite demonstrating retry behavior
- 4 test cases covering different scenarios
- Validates exponential backoff and error handling

## How It Works

```
API Call → Error (503) → Wait 1s → Retry → Error (503) → Wait 2s → Retry → Success
```

### Exponential Backoff Timeline
- **Attempt 1**: Immediate
- **Attempt 2**: ~1s delay (1s + 0-300ms jitter)
- **Attempt 3**: ~2s delay (2s + 0-600ms jitter)
- **Attempt 4**: ~4s delay (4s + 0-1.2s jitter)

Total time before giving up: ~7-10 seconds

## Testing

Run the test suite:
```bash
node server/test-retry-logic.js
```

Expected output shows:
- ✓ 503 errors retry and succeed
- ✓ Non-retryable errors fail immediately
- ✓ Persistent failures exhaust all retries
- ✓ Rate limits (429) are handled with retry

## Benefits

1. **Resilience**: Automatically handles temporary API unavailability
2. **Better UX**: Users get clear error messages instead of cryptic API errors
3. **Reduced Load**: Exponential backoff prevents overwhelming the API during recovery
4. **Debugging**: Comprehensive logging helps identify patterns
5. **Configurable**: Easy to adjust retry behavior without changing core logic

## Additional Recommendations

### For Production:
1. **Monitor retry rates** - Track how often retries happen to identify API reliability issues
2. **Consider circuit breaker** - After repeated failures, temporarily disable the feature
3. **Add request queuing** - For high-traffic scenarios, queue requests instead of immediate retries
4. **Cache responses** - Cache successful responses to reduce API calls
5. **Alternative models** - Consider fallback to different Gemini models or other AI services

### Environment Variables
Ensure your `.env` file has:
```env
GEMINI_API_KEY=your_api_key_here
```

## Troubleshooting

If you still see 503 errors:
1. **Wait a few minutes** - The error is usually temporary
2. **Check Google Cloud status** - Visit https://status.cloud.google.com/
3. **Verify API quota** - Ensure you haven't exceeded your quota limits
4. **Review logs** - Check server logs for detailed error messages
5. **Try again later** - High demand periods may require waiting

## References
- [Google Generative AI Documentation](https://ai.google.dev/docs)
- [Exponential Backoff Algorithm](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Retry Pattern Best Practices](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)