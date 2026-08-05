/**
 * Test script to demonstrate the retry logic for Gemini API
 * This simulates the retry behavior without making actual API calls
 */

// Simulate the retry configuration and helper functions
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 10000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateRetryDelay = (retryCount) => {
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
    MAX_RETRY_DELAY
  );
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
};

const isRetryableError = (error) => {
  const errorMessage = error.message || '';
  
  if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
    return true;
  }
  
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return true;
  }
  
  if (errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ENOTFOUND')) {
    return true;
  }
  
  return false;
};

const executeWithRetry = async (operation, operationName = 'Gemini API') => {
  let lastError;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === MAX_RETRIES) {
        break;
      }
      
      if (!isRetryableError(error)) {
        console.error(`[${operationName}] Non-retryable error:`, error.message);
        throw error;
      }
      
      const delay = calculateRetryDelay(attempt);
      console.warn(
        `[${operationName}] Attempt ${attempt + 1} failed with retryable error. ` +
        `Retrying in ${Math.round(delay)}ms... Error: ${error.message}`
      );
      
      await sleep(delay);
    }
  }
  
  console.error(`[${operationName}] All ${MAX_RETRIES + 1} attempts failed.`);
  throw lastError;
};

// Test 1: Simulate 503 error that succeeds on retry
async function test503WithRetry() {
  console.log('\n=== Test 1: 503 Error with Successful Retry ===');
  let attempts = 0;
  
  try {
    const result = await executeWithRetry(
      async () => {
        attempts++;
        console.log(`  Attempt ${attempts}: Making API call...`);
        
        // Simulate 503 on first 2 attempts, success on 3rd
        if (attempts < 3) {
          throw new Error('503 Service Unavailable');
        }
        
        return { success: true, data: 'Mock successful response' };
      },
      'Test API'
    );
    
    console.log(`  ✓ Success after ${attempts} attempts:`, result);
  } catch (error) {
    console.log(`  ✗ Failed after ${attempts} attempts:`, error.message);
  }
}

// Test 2: Simulate permanent failure (non-retryable error)
async function testNonRetryableError() {
  console.log('\n=== Test 2: Non-Retryable Error (400 Bad Request) ===');
  let attempts = 0;
  
  try {
    const result = await executeWithRetry(
      async () => {
        attempts++;
        console.log(`  Attempt ${attempts}: Making API call...`);
        throw new Error('400 Bad Request - Invalid parameters');
      },
      'Test API'
    );
    
    console.log(`  ✓ Success:`, result);
  } catch (error) {
    console.log(`  ✗ Failed after ${attempts} attempts (expected):`, error.message);
  }
}

// Test 3: Simulate all retries exhausted
async function testAllRetriesExhausted() {
  console.log('\n=== Test 3: All Retries Exhausted (Persistent 503) ===');
  let attempts = 0;
  
  try {
    const result = await executeWithRetry(
      async () => {
        attempts++;
        console.log(`  Attempt ${attempts}: Making API call...`);
        throw new Error('503 Service Unavailable');
      },
      'Test API'
    );
    
    console.log(`  ✓ Success:`, result);
  } catch (error) {
    console.log(`  ✗ Failed after ${attempts} attempts (expected):`, error.message);
  }
}

// Test 4: Simulate rate limit (429)
async function testRateLimit() {
  console.log('\n=== Test 4: Rate Limit (429) with Retry ===');
  let attempts = 0;
  
  try {
    const result = await executeWithRetry(
      async () => {
        attempts++;
        console.log(`  Attempt ${attempts}: Making API call...`);
        
        // Simulate 429 on first attempt, success on 2nd
        if (attempts === 1) {
          throw new Error('429 Too Many Requests - rate limit exceeded');
        }
        
        return { success: true, data: 'Mock successful response' };
      },
      'Test API'
    );
    
    console.log(`  ✓ Success after ${attempts} attempts:`, result);
  } catch (error) {
    console.log(`  ✗ Failed after ${attempts} attempts:`, error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Gemini API Retry Logic - Test Suite                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  await test503WithRetry();
  await testNonRetryableError();
  await testAllRetriesExhausted();
  await testRateLimit();
  
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  All tests completed!                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

// Run tests
runAllTests().catch(console.error);