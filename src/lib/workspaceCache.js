const DB_NAME = 'free-crossposter-cache'
const DB_VERSION = 1
const STORE = 'entries'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function openCache() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise(resolve => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

export async function getWorkspaceCache(userId, key) {
  if (!userId || !key) return null
  const db = await openCache()
  if (!db) return null
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(userId + ':' + key)
    request.onsuccess = () => {
      const entry = request.result
      if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) {
          const cleanup = db.transaction(STORE, 'readwrite')
          cleanup.objectStore(STORE).delete(userId + ':' + key)
        }
        resolve(null)
      } else resolve(entry.value ?? null)
    }
    request.onerror = () => resolve(null)
    tx.oncomplete = () => db.close()
    tx.onerror = () => db.close()
  })
}

export async function setWorkspaceCache(userId, key, value) {
  if (!userId || !key || value === undefined) return
  const db = await openCache()
  if (!db) return
  await new Promise(resolve => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ id: userId + ':' + key, userId, key, value, updatedAt: Date.now(), expiresAt: Date.now() + MAX_AGE_MS })
    tx.oncomplete = resolve
    tx.onerror = resolve
    tx.onabort = resolve
  })
  const cleanupDb = await openCache()
  if (cleanupDb) {
    await new Promise(resolve => {
      const tx = cleanupDb.transaction(STORE, 'readwrite')
      const request = tx.objectStore(STORE).openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        if (cursor.value.expiresAt <= Date.now()) cursor.delete()
        cursor.continue()
      }
      tx.oncomplete = resolve
      tx.onerror = resolve
      tx.onabort = resolve
    })
    cleanupDb.close()
  }
  db.close()
}

export async function clearWorkspaceCache(userId) {
  if (!userId) return
  const db = await openCache()
  if (!db) return
  await new Promise(resolve => {
    const tx = db.transaction(STORE, 'readwrite')
    const request = tx.objectStore(STORE).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      if (cursor.value.userId === userId) cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = resolve
    tx.onerror = resolve
    tx.onabort = resolve
  })
  db.close()
}
