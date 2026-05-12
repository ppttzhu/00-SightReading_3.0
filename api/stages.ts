import { put, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const BLOB_FILENAME = 'stages.json';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // List blobs to find our stages.json
      const { blobs } = await list({ prefix: BLOB_FILENAME });
      if (blobs.length === 0) {
        return res.status(200).json(null);
      }

      // Fetch the blob content with auth token (required for private stores)
      const latestBlob = blobs[blobs.length - 1];
      const response = await fetch(latestBlob.url, {
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Blob fetch failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    } catch (e: any) {
      console.error('[API] GET /api/stages error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    // Simple token auth for writes (teacher CMS)
    const authToken = req.headers.authorization?.replace('Bearer ', '');
    const expectedToken = process.env.CMS_SECRET;

    if (expectedToken && authToken !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const data = req.body;

      // Upload to Vercel Blob (private access, overwrite existing)
      const blob = await put(BLOB_FILENAME, JSON.stringify(data, null, 2), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return res.status(200).json({ success: true, url: blob.url });
    } catch (e: any) {
      console.error('[API] POST /api/stages error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
