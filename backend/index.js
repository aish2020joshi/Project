const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const XLSX = require('xlsx');
const mammoth = require('mammoth');

const app = express();
const STORAGE_DIR = path.join(__dirname, 'storage');
const UPLOAD_DIR = path.join(STORAGE_DIR, 'uploads');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');
const upload = multer({ storage: multer.memoryStorage() });

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

const defaultData = {
  General: [],
  SakriyaSadasya: [],
  Sankarashyaksadashya: []
};

function readData() {
  try {
    const text = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(text || '{}');
  } catch (error) {
    return { ...defaultData };
  }
}

function writeData(data) {
  const merged = { ...defaultData, ...data };
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf8');
  Object.keys(merged).forEach((category) => {
    const categoryFile = path.join(STORAGE_DIR, `${category}.json`);
    fs.writeFileSync(categoryFile, JSON.stringify(merged[category] || [], null, 2), 'utf8');
  });
}

function saveUploadedFile(file, category) {
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9-_. ]/g, '_');
  const categoryDir = path.join(UPLOAD_DIR, category);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  const savePath = path.join(categoryDir, `${timestamp}-${safeName}`);
  fs.writeFileSync(savePath, file.buffer);
  return savePath;
}

function listUploads(category) {
  const categories = category ? [category] : fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const result = {};
  categories.forEach((cat) => {
    const categoryDir = path.join(UPLOAD_DIR, cat);
    if (!fs.existsSync(categoryDir)) return;
    result[cat] = fs.readdirSync(categoryDir).map((name) => {
      const filePath = path.join(categoryDir, name);
      const stats = fs.statSync(filePath);
      return {
        filename: name,
        savedAt: stats.mtime.toISOString(),
        path: `/uploads/${encodeURIComponent(cat)}/${encodeURIComponent(name)}`
      };
    });
  });
  return result;
}

function normalizeCategory(category) {
  const key = (category || 'General').toString().trim().toLowerCase().replace(/\s+/g, '');
  if (key === 'sakriyasadasya') return 'SakriyaSadasya';
  if (key.startsWith('sankar') || key.includes('sankara') || key.includes('sankara')) return 'Sankarashyaksadashya';
  return 'General';
}

function detectCategoryFromFilename(filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.includes('sankar')) return 'Sankarashyaksadashya';
  if (lower.includes('sakriya')) return 'SakriyaSadasya';
  if (lower.includes('general')) return 'General';
  return null;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

function parseXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (jsonData.length === 0) return [];
  const headers = jsonData[0].map((h) => String(h || '').trim());
  return jsonData.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = String(row[index] || '');
    });
    return obj;
  });
}

async function parseDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const raw = result.value
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .trim();

    const lines = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    const headerLine = lines[0];
    const headers = headerLine
      .split(/\t+/)
      .map((h) => h.trim())
      .filter(Boolean);

    const rows = [];
    let currentRow = null;

    for (const line of lines.slice(1)) {
      const tokens = line
        .split(/\t+/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (tokens.length === 0) {
        continue;
      }

      const looksLikeNewRow = /^[0-9]{1,3}$/u.test(tokens[0]);
      if (looksLikeNewRow && tokens.length >= 2) {
        if (currentRow) {
          rows.push(currentRow);
        }
        currentRow = tokens;
      } else if (currentRow) {
        currentRow = currentRow.concat(tokens);
      } else {
        currentRow = tokens;
      }
    }

    if (currentRow) {
      rows.push(currentRow);
    }

    return rows.map((tokens) => {
      const item = {};
      headers.forEach((header, index) => {
        if (index === headers.length - 1) {
          item[header] = tokens.slice(index).join(' ').trim();
        } else {
          item[header] = tokens[index] ? tokens[index].trim() : '';
        }
      });
      return item;
    });
  } catch (error) {
    throw new Error('Unable to parse DOCX file');
  }
}

app.get('/api/items', (req, res) => {
  const category = normalizeCategory(req.query.category);
  const data = readData();
  return res.json(data[category] || []);
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const passedCategory = req.body.category || req.query.category;
  const detectedFromFilename = detectCategoryFromFilename(file.originalname);
  const category = passedCategory ? normalizeCategory(passedCategory) : (detectedFromFilename || 'General');

  const savedPath = saveUploadedFile(file, category);
  let items = [];
  const filename = file.originalname.toLowerCase();

  try {
    if (filename.endsWith('.json')) {
      const raw = file.buffer.toString('utf8');
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      items = parseXLSX(file.buffer);
    } else if (filename.endsWith('.docx')) {
      items = await parseDOCX(file.buffer);
    } else if (filename.endsWith('.doc')) {
      const raw = file.buffer.toString('utf8');
      items = parseCSV(raw);
    } else {
      const raw = file.buffer.toString('utf8');
      items = parseCSV(raw);
    }
  } catch (error) {
    return res.status(400).json({ error: `File saved at backend but parsing failed: ${error.message}` });
  }

  const data = readData();
  data[category] = [...(data[category] || []), ...items];
  writeData(data);
  return res.json({ category, added: items.length, savedPath });
});

app.post('/api/item', (req, res) => {
  const category = normalizeCategory(req.body.category || 'General');
  const item = req.body.item;
  if (!item || typeof item !== 'object') {
    return res.status(400).json({ error: 'Missing item body.' });
  }

  const data = readData();
  data[category] = [...(data[category] || []), item];
  writeData(data);
  return res.json({ success: true, item });
});

app.post('/api/item/update', (req, res) => {
  const category = normalizeCategory(req.body.category || 'General');
  const index = Number(req.body.index);
  const item = req.body.item;

  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid item index.' });
  }
  if (!item || typeof item !== 'object') {
    return res.status(400).json({ error: 'Missing item body.' });
  }

  const data = readData();
  if (!Array.isArray(data[category]) || index >= data[category].length) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  data[category][index] = item;
  writeData(data);
  return res.json({ success: true, item });
});

app.post('/api/item/delete', (req, res) => {
  const category = normalizeCategory(req.body.category || 'General');
  const index = Number(req.body.index);

  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid item index.' });
  }

  const data = readData();
  if (!Array.isArray(data[category]) || index >= data[category].length) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  data[category].splice(index, 1);
  writeData(data);
  return res.json({ success: true });
});

app.get('/api/categories', (req, res) => {
  res.json(['General', 'SakriyaSadasya', 'Sankarashyaksadashya']);
});

app.get('/api/uploads', (req, res) => {
  const category = req.query.category ? normalizeCategory(req.query.category) : null;
  res.json(listUploads(category));
});

app.delete('/api/uploads', (req, res) => {
  const category = normalizeCategory(req.query.category);
  const filename = req.query.filename;
  if (!category || !filename) {
    return res.status(400).json({ error: 'Category and filename are required.' });
  }

  const categoryDir = path.join(UPLOAD_DIR, category);
  const filePath = path.join(categoryDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file.' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
