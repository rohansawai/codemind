/**
 * Pagination utilities for handling large result sets
 */

/**
 * Paginate an array of results
 * @param {Array} items - Full array of items
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} - Paginated results with metadata
 */
export function paginate(items, page = 1, pageSize = 50) {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.max(1, Math.min(page, totalPages));
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  
  const pageItems = items.slice(startIndex, endIndex);

  return {
    items: pageItems,
    pagination: {
      currentPage,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      startIndex: startIndex + 1, // 1-indexed for display
      endIndex,
    },
  };
}

/**
 * Format pagination info for display
 * @param {Object} paginationInfo - Pagination metadata
 * @returns {string} - Formatted string
 */
export function formatPaginationInfo(paginationInfo) {
  const { currentPage, totalPages, totalItems, startIndex, endIndex } = paginationInfo;
  
  return `Showing ${startIndex}-${endIndex} of ${totalItems} (page ${currentPage}/${totalPages})`;
}

/**
 * Redis cursor-based pagination helper
 * Handles SCAN operations for large datasets
 * 
 * @param {Object} redisClient - Redis client
 * @param {string} pattern - Key pattern to match
 * @param {number} count - Items per scan
 * @returns {AsyncGenerator} - Yields batches of keys
 */
export async function* redisScan(redisClient, pattern, count = 100) {
  let cursor = '0';
  
  do {
    const [nextCursor, keys] = await redisClient.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      count
    );
    
    if (keys.length > 0) {
      yield keys;
    }
    
    cursor = nextCursor;
  } while (cursor !== '0');
}

/**
 * Get all items with automatic pagination
 * Good for CLI where you want to show "X more results" prompts
 * 
 * @param {Array} allItems - Full result set
 * @param {number} initialPageSize - First page size
 * @returns {Object} - Interactive pagination helper
 */
export function createPaginationHelper(allItems, initialPageSize = 50) {
  let currentPage = 1;
  const pageSize = initialPageSize;
  
  return {
    getPage(page = currentPage) {
      return paginate(allItems, page, pageSize);
    },
    
    next() {
      currentPage++;
      return this.getPage();
    },
    
    prev() {
      currentPage = Math.max(1, currentPage - 1);
      return this.getPage();
    },
    
    hasMore() {
      const totalPages = Math.ceil(allItems.length / pageSize);
      return currentPage < totalPages;
    },
    
    reset() {
      currentPage = 1;
    },
  };
}

