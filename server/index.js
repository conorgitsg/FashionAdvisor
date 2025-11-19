require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const db = require('./database');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'fashion-advisor';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TAGGING_MODEL = process.env.OPENAI_TAGGING_MODEL || 'gpt-4o';
const STYLIST_MODEL = process.env.OPENAI_STYLIST_MODEL || TAGGING_MODEL;
const WARDROBE_FOLDER = process.env.WARDROBE_FOLDER || 'wardrobe';
const REGION = process.env.AWS_REGION || 'ap-southeast-1';

const BASE_SYSTEM_PROMPT = `
You are a professional fashion stylist and wardrobe-cataloging engine.
For every request, you will receive an image of a single clothing item or pair.
Analyze the image and output a single JSON object with this schema:
{
  "item_name": "",
  "broad_category": "",
  "sub_category": "",
  "silhouette": "",
  "materials": "",
  "colors": [],
  "patterns": "",
  "construction_details": "",
  "style_vibe": "",
  "best_pairings": [],
  "seasonality": [],
  "tags": []
}
Field rules:
- broad_category: one of tops, bottoms, one-piece, outerwear, shoes, accessories, underwear/sleepwear, sportswear/athleisure
- colors: array of simple color names in order of dominance
- tags: single words or hyphenated phrases combining category, colors, materials, style vibe, distinctive features
Rules:
- Analyze the clothing item only, never the person
- Do not infer brands or price
- Use only visual information
- Output valid JSON only (no extra text)
`.trim();

const OUTFIT_SYSTEM_PROMPT = `
You are an AI stylist. Given:
- user persona/preferences,
- upcoming days (weather + events),
- wardrobe items (id + tags),
- existing outfits (id + item_ids),
recommend outfits for each day using the provided wardrobe IDs.

Rules:
- Always output JSON only, no prose.
- Prefer reusing existing outfits if they exactly match the recommended item set.
- Do not introduce items that are not in the provided wardrobe.
- Respect seasonality, weather, event formality, and the user's stated style/fit preferences.
- Avoid exact repeats within the same horizon unless unavoidable.

Output schema:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "outfit": [
        { "item_id": "<wardrobe item id>", "reason": "short explanation" }
      ],
      "use_existing_outfit_id": "<optional outfit id if a perfect match exists>",
      "notes": "optional styling notes"
    }
  ]
}
`.trim();

function buildS3Key(extension = 'jpg') {
  return `${WARDROBE_FOLDER}/${uuidv4()}.${extension}`;
}

async function removeBackground(imageBuffer, contentType) {
  // Placeholder: returns original buffer. Swap in real background removal when ready.
  return { cleanedBuffer: imageBuffer, cleanedContentType: contentType };
}

async function callVisionTagger(imageBuffer, contentType) {
  const base64 = imageBuffer.toString('base64');
  const completion = await openai.chat.completions.create({
    model: TAGGING_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: BASE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this clothing item and return JSON per the schema.' },
          { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } }
        ]
      }
    ]
  });

  const message = completion.choices?.[0]?.message?.content;
  let tags = {};
  try {
    tags = message ? JSON.parse(message) : {};
  } catch (err) {
    console.error('Failed to parse tagging JSON', err);
    throw new Error('Tagging response was not valid JSON');
  }

  return { tags, raw: completion };
}

async function ensureOutfitsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS outfits (
      id UUID PRIMARY KEY,
      name TEXT,
      item_ids TEXT[] NOT NULL,
      tags JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
ensureOutfitsTable().catch(err => {
  console.error('Failed to ensure outfits table exists', err);
});

// Health check
app.get('/api/health', async (req, res) => {
  const dbHealth = await db.healthCheck();
  res.json({
    status: 'ok',
    bucket: BUCKET_NAME,
    region: process.env.AWS_REGION,
    database: dbHealth
  });
});

// Database health check
app.get('/api/db/health', async (req, res) => {
  const health = await db.healthCheck();
  res.json(health);
});

// Upload image
app.post('/api/images/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const fileExtension = req.file.originalname.split('.').pop();
    const key = `images/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.json({
      url,
      key,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get presigned URL for direct upload
app.post('/api/images/presigned-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ message: 'filename and contentType are required' });
    }

    const fileExtension = filename.split('.').pop();
    const key = `images/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({ uploadUrl, key });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({ message: error.message });
  }
});

// List images
app.get('/api/images', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const continuationToken = req.query.continuationToken;

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'images/',
      MaxKeys: limit,
      ContinuationToken: continuationToken
    });

    const response = await s3Client.send(command);

    const images = await Promise.all(
      (response.Contents || []).map(async (item) => {
        const headCommand = new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: item.Key
        });

        try {
          const headResponse = await s3Client.send(headCommand);
          return {
            key: item.Key,
            url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`,
            filename: item.Key.split('/').pop(),
            size: item.Size,
            contentType: headResponse.ContentType,
            uploadedAt: item.LastModified.toISOString()
          };
        } catch {
          return {
            key: item.Key,
            url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`,
            filename: item.Key.split('/').pop(),
            size: item.Size,
            contentType: 'unknown',
            uploadedAt: item.LastModified.toISOString()
          };
        }
      })
    );

    res.json({
      images,
      nextToken: response.NextContinuationToken
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get image metadata
app.get('/api/images/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;

    // Check if this is a signed-url request
    if (key.endsWith('/signed-url')) {
      const imageKey = key.replace('/signed-url', '');
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: imageKey
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return res.json({ url });
    }

    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);

    res.json({
      key,
      url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      filename: key.split('/').pop(),
      size: response.ContentLength,
      contentType: response.ContentType,
      uploadedAt: response.LastModified.toISOString()
    });
  } catch (error) {
    if (error.name === 'NotFound') {
      return res.status(404).json({ message: 'Image not found' });
    }
    console.error('Get metadata error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete image
app.delete('/api/images/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    res.status(204).send();
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Tag wardrobe item with GPT-4o vision and persist tags + cleaned image
app.post('/api/wardrobe/items/tag', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const notes = req.body.notes || null;
    const itemId = uuidv4();
    const originalExt = req.file.originalname.split('.').pop();
    const extFromMime = (req.file.mimetype && req.file.mimetype.split('/')[1]) || 'jpg';
    const extension = (originalExt || extFromMime || 'jpg').toLowerCase();

    // 1) Background removal (placeholder)
    const { cleanedBuffer, cleanedContentType } = await removeBackground(
      req.file.buffer,
      req.file.mimetype
    );

    // 2) Upload cleaned image to S3
    const key = buildS3Key(extension);
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: cleanedBuffer,
      ContentType: cleanedContentType || req.file.mimetype
    });
    await s3Client.send(putCommand);
    const imageUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;

    // 3) Tag with OpenAI vision
    const { tags, raw } = await callVisionTagger(
      cleanedBuffer,
      cleanedContentType || req.file.mimetype
    );

    // 4) Persist tags to DB
    await db.query(
      `INSERT INTO wardrobe_items (id, s3_key, tags, raw_gpt, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [itemId, key, tags, raw, notes]
    );

    // 5) Return payload
    res.json({
      itemId,
      s3Key: key,
      imageUrl,
      tags,
      rawGpt: raw
    });
  } catch (error) {
    console.error('Tagging error:', error);
    res.status(500).json({ message: error.message });
  }
});

// List wardrobe items from database with S3 URLs
app.get('/api/wardrobe/items', async (req, res) => {
  try {
    // Try wardrobe table first, fall back to wardrobe_items
    let result;
    try {
      result = await db.query(
        `SELECT id, s3_key, tags, notes, created_at FROM wardrobe ORDER BY created_at DESC`
      );
    } catch (err) {
      // Fallback to wardrobe_items table
      result = await db.query(
        `SELECT id, s3_key, tags, notes, created_at FROM wardrobe_items ORDER BY created_at DESC`
      );
    }

    // Generate signed URLs for each item
    const items = await Promise.all(result.rows.map(async (row) => {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: row.s3_key
      });
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return {
        id: row.id,
        s3Key: row.s3_key,
        imageUrl: signedUrl,
        tags: row.tags || {},
        notes: row.notes,
        createdAt: row.created_at
      };
    }));

    res.json({ items });
  } catch (error) {
    console.error('List wardrobe items error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Recommend outfits for upcoming days using persona + wardrobe tags + weather
app.post('/api/stylist/recommend', async (req, res) => {
  try {
    const { user, days, rules } = req.body || {};

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ message: 'days[] is required' });
    }

    // Load wardrobe items (all for now; could be filtered by seasonality in future)
    const wardrobeRows = await db.query('SELECT id, tags FROM wardrobe_items');
    const wardrobe = wardrobeRows.rows || [];

    // Load existing outfits to reuse/dedupe
    const existingOutfitsRows = await db.query('SELECT id, item_ids FROM outfits');
    const existingOutfits = existingOutfitsRows.rows || [];
    const existingMap = new Map(
      existingOutfits.map((o) => [normalizeItemIds(o.item_ids), o.id])
    );

    const userContent = {
      user: user || {},
      days,
      wardrobe: wardrobe.map((w) => ({ id: w.id, tags: w.tags })),
      existing_outfits: existingOutfits.map((o) => ({ id: o.id, item_ids: o.item_ids })),
      rules: rules || {}
    };

    const completion = await openai.chat.completions.create({
      model: STYLIST_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: OUTFIT_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userContent) }
      ]
    });

    const message = completion.choices?.[0]?.message?.content;
    if (!message) {
      return res.status(502).json({ message: 'No response from stylist model' });
    }

    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (err) {
      console.error('Failed to parse stylist JSON', err);
      return res.status(502).json({ message: 'Stylist response not valid JSON' });
    }

    const outDays = Array.isArray(parsed?.days) ? parsed.days : [];

    // Save any new outfits and attach outfitId reference
    const results = [];
    for (const day of outDays) {
      const outfitItems = Array.isArray(day?.outfit) ? day.outfit : [];
      const normalizedKey = normalizeItemIds(outfitItems.map((i) => i.item_id));

      let outfitId = null;
      if (day.use_existing_outfit_id && existingMap.has(normalizedKey)) {
        outfitId = existingMap.get(normalizedKey);
      } else if (existingMap.has(normalizedKey)) {
        outfitId = existingMap.get(normalizedKey);
      } else if (outfitItems.length > 0) {
        outfitId = uuidv4();
        await db.query(
          `INSERT INTO outfits (id, item_ids, tags, notes, name)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            outfitId,
            outfitItems.map((i) => i.item_id),
            day.tags || null,
            day.notes || null,
            day.name || null
          ]
        );
        existingMap.set(normalizedKey, outfitId);
      }

      results.push({
        date: day.date,
        outfitId,
        outfit: outfitItems,
        notes: day.notes || null
      });
    }

    res.json({
      days: results,
      raw: completion
    });
  } catch (error) {
    console.error('Stylist recommend error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Image file is too large' });
    }
  }
  if (error.message === 'Only image files are allowed') {
    return res.status(415).json({ message: 'Unsupported image format' });
  }
  res.status(500).json({ message: error.message });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`S3 Bucket: ${BUCKET_NAME}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || 'ap-southeast-1'}`);
});

function normalizeItemIds(items) {
  if (!Array.isArray(items)) return '';
  return [...items].filter(Boolean).map(String).sort().join('|');
}
