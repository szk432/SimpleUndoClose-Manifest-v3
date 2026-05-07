// storage.js - Chrome Storage API wrapper for Manifest V3
// Provides localStorage-like synchronous API using chrome.storage.local

const Storage = {
  // Get a single value (returns Promise)
  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  },

  // Get multiple values (returns Promise)
  async getMultiple(keys) {
    return await chrome.storage.local.get(keys);
  },

  // Set a single value (returns Promise)
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  // Set multiple values (returns Promise)
  async setMultiple(items) {
    await chrome.storage.local.set(items);
  },

  // Remove a single key (returns Promise)
  async remove(key) {
    await chrome.storage.local.remove(key);
  },

  // Remove multiple keys (returns Promise)
  async removeMultiple(keys) {
    await chrome.storage.local.remove(keys);
  },

  // Clear all storage (returns Promise)
  async clear() {
    await chrome.storage.local.clear();
  },

  // Get all keys (returns Promise)
  async getKeys() {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all);
  },

  // Get all items (returns Promise)
  async getAll() {
    return await chrome.storage.local.get(null);
  },

  // Check if key exists (returns Promise)
  async has(key) {
    const result = await chrome.storage.local.get(key);
    return result.hasOwnProperty(key);
  },

  // Get storage size (returns Promise)
  async size() {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all).length;
  }
};

// Export for ES modules
export default Storage;