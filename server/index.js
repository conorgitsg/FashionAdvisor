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

async function ensurePersonasTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS personas (
      id UUID PRIMARY KEY,
      user_id TEXT,
      profile JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// Middleware
const allowedOrigins = [
  'http://localhost:4200',
  'https://fashionadvisorhack.onrender.com',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
ensureOutfitsTable().catch(err => {
  console.error('Failed to ensure outfits table exists', err);
});
ensurePersonasTable().catch(err => {
  console.error('Failed to ensure personas table exists', err);
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

// Delete wardrobe item
app.delete('/api/wardrobe/items/:id', async (req, res) => {
  try {
    const itemId = req.params.id;

    // Get the S3 key before deleting
    let result;
    try {
      result = await db.query('SELECT s3_key FROM wardrobe WHERE id = $1', [itemId]);
    } catch {
      result = await db.query('SELECT s3_key FROM wardrobe_items WHERE id = $1', [itemId]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const s3Key = result.rows[0].s3_key;

    // Delete from S3
    if (s3Key) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      });
      await s3Client.send(deleteCommand);
    }

    // Delete from database
    try {
      await db.query('DELETE FROM wardrobe WHERE id = $1', [itemId]);
    } catch {
      await db.query('DELETE FROM wardrobe_items WHERE id = $1', [itemId]);
    }

    // Remove the item from any saved outfits and prune empty outfits
    await db.query(
      `UPDATE outfits
       SET item_ids = array_remove(item_ids, $1)
       WHERE item_ids IS NOT NULL`,
      [itemId]
    );
    await db.query('DELETE FROM outfits WHERE item_ids IS NULL OR array_length(item_ids, 1) = 0');

    res.status(204).send();
  } catch (error) {
    console.error('Delete wardrobe item error:', error);
    res.status(500).json({ message: error.message });
  }
});

// List saved outfits from database with resolved wardrobe items
app.get('/api/outfits', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, item_ids, tags, notes, created_at
       FROM outfits
       ORDER BY created_at DESC`
    );

    if (result.rows.length === 0) {
      return res.json({ outfits: [] });
    }

    const allItemIds = [
      ...new Set(result.rows.flatMap(row => row.item_ids || []).filter(Boolean))
    ];
    const wardrobeMap = await fetchWardrobeItemsForOutfits(allItemIds);

    const payload = result.rows.map(outfit => {
      const items = (outfit.item_ids || [])
        .map((itemId) => wardrobeMap.get(itemId))
        .filter(Boolean);

      return {
        id: outfit.id,
        name: outfit.name || 'Saved Outfit',
        tags: normalizeOutfitTags(outfit.tags),
        notes: outfit.notes || null,
        imageUrl: items[0]?.imageUrl || null,
        pieceCount: items.length,
        lastModified: outfit.created_at,
        items
      };
    });

    res.json({ outfits: payload });
  } catch (error) {
    console.error('List outfits error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete outfit
app.delete('/api/outfits/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM outfits WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Outfit not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Delete outfit error:', error);
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

    const { results, raw } = await generateStylistRecommendations(user || {}, days, rules || {});
    res.json({ days: results, raw });
  } catch (error) {
    console.error('Stylist recommend error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Daily outfit endpoint (saved or newly generated)
app.post('/api/stylist/daily', async (req, res) => {
  try {
    const strategy = (req.body?.strategy || 'existing').toLowerCase();
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const user = req.body?.user || {};
    const rules = req.body?.rules || {};
    const weather = req.body?.weather || null;
    const dayPayload = req.body?.day || {
      date: new Date().toISOString().slice(0, 10),
      weather,
      event: req.body?.event || null
    };

    const outfits = await getDetailedOutfits();

    if (strategy !== 'new' && outfits.length > 0) {
      const mainIndex = Math.floor(Math.random() * outfits.length);
      const main = outfits[mainIndex];
      const alternatives = outfits.filter((_, idx) => idx !== mainIndex).slice(0, 2);

      const formattedMain = formatOutfitForDaily(main, 'Pulled from your saved outfits.');
      const formattedAlternatives = alternatives
        .map((outfit) => formatOutfitForDaily(outfit, 'Another look from your saved catalog.'))
        .filter(Boolean);

      if (!formattedMain) {
        return res.status(500).json({ message: 'Saved outfit could not be formatted' });
      }

      return res.json({
        source: 'existing',
        weather,
        mainOutfit: formattedMain,
        alternatives: formattedAlternatives
      });
    }

    const { results } = await generateStylistRecommendations(user, [dayPayload], {
      ...rules,
      tags
    });

    if (!results.length) {
      return res.status(502).json({ message: 'Unable to generate outfit right now' });
    }

    const generated = results[0];
    if (!generated.outfitId) {
      return res.status(502).json({ message: 'No outfit ID generated' });
    }
    const generatedOutfitList = await getDetailedOutfits([generated.outfitId]);
    const generatedOutfit = generatedOutfitList[0];

    const remainingAlternatives = (await getDetailedOutfits()).filter(
      (o) => o.id !== generated.outfitId
    );

    const formattedMain = formatOutfitForDaily(
      generatedOutfit,
      generated.notes || 'AI stylist created this look for today.'
    );
    if (!formattedMain) {
      return res.status(502).json({ message: 'Unable to resolve generated outfit' });
    }

    const formattedAlternatives = remainingAlternatives
      .slice(0, 2)
      .map((outfit) => formatOutfitForDaily(outfit, 'Previously saved option.'))
      .filter(Boolean);

    res.json({
      source: 'new',
      weather,
      mainOutfit: formattedMain,
      alternatives: formattedAlternatives
    });
  } catch (error) {
    console.error('Daily stylist error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Weekly planner outfits endpoint
app.post('/api/stylist/weekly', async (req, res) => {
  try {
    const { startDate, days, user, rules } = req.body || {};

    let dayEntries = [];
    if (Array.isArray(days) && days.length) {
      dayEntries = days.map(normalizePlannerDayEntry);
    } else {
      const start = startDate ? new Date(startDate) : new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dayEntries.push(normalizePlannerDayEntry({ date }));
      }
    }

    const plan = await planWeeklyOutfits(dayEntries, user || {}, rules || {});
    res.json(plan);
  } catch (error) {
    console.error('Weekly stylist error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Save or update persona profile
app.post('/api/personas', async (req, res) => {
  try {
    const { userId, profile } = req.body || {};
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ message: 'profile is required' });
    }

    const personaId = uuidv4();
    await db.query(
      `INSERT INTO personas (id, user_id, profile)
       VALUES ($1, $2, $3)`,
      [personaId, userId || null, profile]
    );

    res.json({ id: personaId, userId: userId || null, profile });
  } catch (error) {
    console.error('Persona save error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update persona profile
app.put('/api/personas/:id', async (req, res) => {
  try {
    const personaId = req.params.id;
    const { profile, userId } = req.body || {};
    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ message: 'profile is required' });
    }

    const result = await db.query(
      `UPDATE personas
       SET profile = $1,
           user_id = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, user_id, profile, created_at, updated_at`,
      [profile, userId || null, personaId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Persona not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Persona update error:', error);
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

async function generateStylistRecommendations(user = {}, days = [], rules = {}) {
  const wardrobe = await loadWardrobeForStylist();

  const existingOutfitsRows = await db.query('SELECT id, item_ids FROM outfits');
  const existingOutfits = existingOutfitsRows.rows || [];
  const existingMap = new Map(
    existingOutfits.map((o) => [normalizeItemIds(o.item_ids), o.id])
  );

  const userContent = {
    user,
    days,
    wardrobe: wardrobe.map((w) => ({ id: w.id, tags: w.tags })),
    existing_outfits: existingOutfits.map((o) => ({ id: o.id, item_ids: o.item_ids })),
    rules
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
    throw new Error('No response from stylist model');
  }

  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch (err) {
    console.error('Failed to parse stylist JSON', err);
    throw new Error('Stylist response not valid JSON');
  }

  const outDays = Array.isArray(parsed?.days) ? parsed.days : [];
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

  return { results, raw: completion };
}

async function loadWardrobeForStylist() {
  try {
    const result = await db.query('SELECT id, tags FROM wardrobe');
    return result.rows || [];
  } catch {
    const fallback = await db.query('SELECT id, tags FROM wardrobe_items');
    return fallback.rows || [];
  }
}

async function getDetailedOutfits(outfitIds = []) {
  let query = `SELECT id, name, item_ids, tags, notes, created_at FROM outfits`;
  let params = [];

  if (outfitIds && outfitIds.length > 0) {
    query += ` WHERE id = ANY($1::uuid[])`;
    params = [outfitIds];
  }

  query += ` ORDER BY created_at DESC`;

  const result = params.length > 0 ? await db.query(query, params) : await db.query(query);
  if (!result.rows.length) {
    return [];
  }

  const allItemIds = [
    ...new Set(result.rows.flatMap((row) => row.item_ids || []).filter(Boolean))
  ];
  const itemMap = await fetchWardrobeItemsForOutfits(allItemIds);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name || 'Saved Outfit',
    tags: normalizeOutfitTags(row.tags),
    notes: row.notes || null,
    createdAt: row.created_at,
    items: (row.item_ids || []).map((itemId) => itemMap.get(itemId)).filter(Boolean)
  }));
}

function formatOutfitForDaily(outfit, fallbackReason = '') {
  if (!outfit) {
    return null;
  }

  return {
    id: outfit.id,
    name: outfit.name,
    reason: outfit.notes || fallbackReason || 'Saved outfit from your catalog.',
    items: (outfit.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      imageUrl: item.imageUrl,
      color: Array.isArray(item.colors) ? item.colors[0] : null
    }))
  };
}

function formatOutfitForPlanner(outfit) {
  if (!outfit) return null;
  return {
    id: outfit.id,
    items: (outfit.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      imageUrl: item.imageUrl,
      color: Array.isArray(item.colors) ? item.colors[0] : null
    }))
  };
}

async function fetchWardrobeItemsForOutfits(ids = []) {
  const map = new Map();
  if (!ids || ids.length === 0) {
    return map;
  }

  const result = await db.query(
    `SELECT id, s3_key, tags, created_at
     FROM wardrobe_items
     WHERE id = ANY($1::uuid[])`,
    [ids]
  );

  for (const row of result.rows) {
    let imageUrl = null;
    if (row.s3_key) {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: row.s3_key
      });
      imageUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    }

    const tags = row.tags || {};
    map.set(row.id, {
      id: row.id,
      name: tags.item_name || 'Unnamed Item',
      type: mapBroadCategoryToType(tags.broad_category),
      category: tags.sub_category || tags.broad_category || 'Other',
      tags: Array.isArray(tags.tags) ? tags.tags : [],
      colors: Array.isArray(tags.colors) ? tags.colors.map((c) => c.toLowerCase()) : [],
      imageUrl,
      usageFrequency: 0,
      dateAdded: row.created_at,
      season: Array.isArray(tags.seasonality) ? tags.seasonality.map((s) => s.toLowerCase()) : [],
      style: tags.style_vibe ? [tags.style_vibe.toLowerCase()] : []
    });
  }

  return map;
}

function mapBroadCategoryToType(category = '') {
  const normalized = category.toLowerCase();
  const map = {
    'tops': 'top',
    'top': 'top',
    'bottoms': 'bottom',
    'bottom': 'bottom',
    'one-piece': 'dress',
    'dress': 'dress',
    'outerwear': 'outerwear',
    'shoes': 'shoes',
    'accessories': 'accessory',
    'underwear/sleepwear': 'accessory',
    'sportswear/athleisure': 'top'
  };
  return map[normalized] || 'accessory';
}

function normalizeOutfitTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.filter(Boolean);
  }
  if (Array.isArray(tags.tags)) {
    return tags.tags.filter(Boolean);
  }
  if (typeof tags === 'string') {
    return [tags];
  }
  return [];
}

function normalizeItemIds(items) {
  if (!Array.isArray(items)) return '';
  return [...items].filter(Boolean).map(String).sort().join('|');
}

function normalizePlannerDayEntry(entry = {}) {
  const date = entry.date ? new Date(entry.date) : new Date();
  return {
    date: date.toISOString().split('T')[0],
    events: Array.isArray(entry.events) ? entry.events : [],
    weather: entry.weather || null
  };
}

async function planWeeklyOutfits(dayEntries, user, rules) {
  const responses = [];
  const usedRestrictedItems = new Set();
  const usedOutfitIds = new Set();
  const existingOutfits = await getDetailedOutfits();
  const flexibleTypes = new Set(['outerwear', 'shoes']);
  const restrictedTypes = new Set(['top', 'bottom', 'dress']);
  const available = [...existingOutfits];

  for (const day of dayEntries) {
    let selected = pickOutfit(available, usedOutfitIds, usedRestrictedItems, restrictedTypes);

    if (!selected) {
      // Allow reuse even if restricted items already used
      selected = pickOutfit(available, usedOutfitIds, null, restrictedTypes, true);
    }

    if (!selected) {
      const { results } = await generateStylistRecommendations(user, [{
        date: day.date,
        weather: day.weather,
        events: day.events
      }], rules);
      if (results.length && results[0].outfitId) {
        const detailed = await getDetailedOutfits([results[0].outfitId]);
        selected = detailed[0];
      }
    }

    if (selected) {
      usedOutfitIds.add(selected.id);
      if (selected.items && restrictedTypes) {
        selected.items.forEach((item) => {
          if (restrictedTypes.has((item.type || '').toLowerCase())) {
            usedRestrictedItems.add(item.id);
          }
        });
      }

      responses.push({
        date: day.date,
        outfitId: selected.id,
        outfit: formatOutfitForPlanner(selected)
      });
    }
  }

  return { days: responses };
}

function pickOutfit(available, usedOutfitIds, usedRestrictedItems, restrictedTypes, allowRestrictedReuse = false) {
  for (let i = 0; i < available.length; i++) {
    const outfit = available[i];
    if (usedOutfitIds.has(outfit.id)) continue;

    if (!allowRestrictedReuse && usedRestrictedItems && restrictedTypes) {
      const conflicts = outfit.items?.some((item) =>
        restrictedTypes.has((item.type || '').toLowerCase()) && usedRestrictedItems.has(item.id)
      );
      if (conflicts) continue;
    }

    available.splice(i, 1);
    return outfit;
  }
  return null;
}
