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

// Middleware
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', bucket: BUCKET_NAME, region: process.env.AWS_REGION });
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`S3 Bucket: ${BUCKET_NAME}`);
  console.log(`AWS Region: ${process.env.AWS_REGION || 'ap-southeast-1'}`);
});
