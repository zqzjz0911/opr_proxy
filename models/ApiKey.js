// For Vercel environment, use in-memory storage since file system is read-only
const isVercel = process.env.VERCEL_ENV === '1';

// In-memory storage for Vercel
let inMemoryKeys = [];

class ApiKey {
  constructor(data) {
    this.key = data.key;
    this.isActive = data.isActive ?? true;
    this.lastUsed = data.lastUsed ? new Date(data.lastUsed) : null;
    this.rateLimitResetAt = data.rateLimitResetAt ? new Date(data.rateLimitResetAt) : null;
    this.failureCount = data.failureCount ?? 0;
    this._id = data._id ?? Date.now().toString();
  }

  static #filterKey(key, query) {
    if (query.isActive && !key.isActive) return false;
    if (query.$or) {
      return query.$or.some(condition => {
        if (condition.rateLimitResetAt === null) {
          return key.rateLimitResetAt === null;
        }
        if (condition.rateLimitResetAt?.$lte) {
          return !key.rateLimitResetAt || new Date(key.rateLimitResetAt) <= new Date();
        }
        return false;
      });
    }
    if (query.key) return key.key === query.key;
    return false;
  }

  static async findOne(query) {
    const keys = await this.#readKeys();
    return keys.find(key => this.#filterKey(key, query));
  }

  static async findAll(query) {
    const keys = await this.#readKeys();
    return keys.filter(key => this.#filterKey(key, query));
  }

  static async create(data) {
    const keys = await this.#readKeys();
    const newKey = new ApiKey(data);
    keys.push(newKey);
    await this.#writeKeys(keys);
    return newKey;
  }

  async save() {
    const keys = await ApiKey.#readKeys();
    const index = keys.findIndex(k => k._id === this._id);
    if (index !== -1) {
      keys[index] = this;
    } else {
      keys.push(this);
    }
    await ApiKey.#writeKeys(keys);
    return this;
  }

  static async #readKeys() {
    if (isVercel) {
      return inMemoryKeys.map(k => new ApiKey(k));
    }
    
    try {
      const fs = await import('fs/promises');
      const { join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const KEYS_FILE = join(__dirname, '../data/keys.json');
      
      const data = await fs.readFile(KEYS_FILE, 'utf8');
      const keys = JSON.parse(data);
      return keys.map(k => new ApiKey(k));
    } catch (error) {
      if (error.code === 'ENOENT') {
        const fs = await import('fs/promises');
        const { join, dirname } = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const KEYS_FILE = join(__dirname, '../data/keys.json');
        
        // Create directory if it doesn't exist
        await fs.mkdir(dirname(KEYS_FILE), { recursive: true });
        await fs.writeFile(KEYS_FILE, '[]');
        return [];
      }
      throw error;
    }
  }

  static async #writeKeys(keys) {
    if (isVercel) {
      inMemoryKeys = keys.map(k => ({
        key: k.key,
        isActive: k.isActive,
        lastUsed: k.lastUsed,
        rateLimitResetAt: k.rateLimitResetAt,
        failureCount: k.failureCount,
        _id: k._id
      }));
      return;
    }
    
    const fs = await import('fs/promises');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const KEYS_FILE = join(__dirname, '../data/keys.json');
    
    await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2));
  }
}

export default ApiKey;