import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';
import * as easymidi from 'easymidi';

loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // We need to access the body, but it's not parsed yet in the destination function
    // So we'll save to a temp location first
    const dir = path.join(__dirname, '../../assets/temp');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// Parse JSON bodies
app.use(express.json());

// Routes
app.get('/api/triggers', (req, res) => {
  try {
    const triggersPath = path.join(__dirname, '../../triggers.json');
    const triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
    res.json(triggers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load triggers' });
  }
});

app.post('/api/triggers', (req, res) => {
  try {
    const triggersPath = path.join(__dirname, '../../triggers.json');
    fs.writeFileSync(triggersPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save triggers' });
  }
});

app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const triggerId = req.body.triggerId;
    const triggerType = req.body.triggerType;
    
    console.log(`File uploaded for trigger: ${triggerId}, type: ${triggerType}`);
    
    // Now move the file to the correct directory
    const targetDir = path.join(__dirname, '../../assets', triggerType);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const sanitizedTriggerId = triggerId.replace(/[^a-z0-9-_]/gi, '-');
    const filename = `${sanitizedTriggerId}-${timestamp}${path.extname(req.file.originalname)}`;
    const targetPath = path.join(targetDir, filename);
    
    // Move the file
    fs.renameSync(req.file.path, targetPath);
    
    console.log(`Moved file to: ${targetPath}`);
    
    // Update triggers.json
    try {
      const triggersPath = path.join(__dirname, '../../triggers.json');
      const triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
      
      const triggerIndex = triggers.triggers.findIndex((t: any) => t.id === triggerId);
      
      if (triggerIndex >= 0) {
        // Update the media file path
        triggers.triggers[triggerIndex].nftMetadata.mediaFile = `./assets/${triggerType}/${filename}`;
        fs.writeFileSync(triggersPath, JSON.stringify(triggers, null, 2));
        
        res.json({ 
          success: true, 
          path: triggers.triggers[triggerIndex].nftMetadata.mediaFile 
        });
      } else {
        res.status(404).json({ error: 'Trigger not found' });
      }
    } catch (error) {
      console.error('Error updating trigger:', error);
      res.status(500).json({ error: 'Failed to update trigger' });
    }
  });
});

app.get('/api/midi-devices', (req, res) => {
  try {
    const inputs = easymidi.getInputs();
    res.json({ devices: inputs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get MIDI devices' });
  }
});

// Modify the media files endpoint
app.get('/api/media-files/:triggerType', (req, res) => {
  try {
    const triggerType = req.params.triggerType;
    const mediaDir = path.join(__dirname, '../../assets', triggerType);
    
    console.log(`Looking for media files in: ${mediaDir}`);
    
    // Check if directory exists
    if (!fs.existsSync(mediaDir)) {
      console.log(`Directory does not exist: ${mediaDir}`);
      return res.json({ files: [] });
    }
    
    // Get all files in the directory
    const files = fs.readdirSync(mediaDir);
    console.log(`Found ${files.length} files in directory:`, files);
    
    // Filter for image files and map to response format
    const imageFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(file => ({
        name: file,
        path: `/assets/${triggerType}/${file}`,
        fullPath: `./assets/${triggerType}/${file}`
      }));
    
    console.log(`Returning ${imageFiles.length} image files`);
    res.json({ files: imageFiles });
  } catch (error) {
    console.error('Error getting media files:', error);
    res.status(500).json({ error: 'Failed to get media files' });
  }
});

// Add a new endpoint for renaming files
app.post('/api/rename-file', (req, res) => {
  try {
    const { oldPath, newName, triggerType } = req.body;
    
    console.log('Rename request received:');
    console.log('  oldPath:', oldPath);
    console.log('  newName:', newName);
    console.log('  triggerType:', triggerType);
    
    if (!oldPath || !newName || !triggerType) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Extract the old filename and directory
    const oldFilePath = path.join(__dirname, '../../', oldPath.replace('./', ''));
    const dirPath = path.dirname(oldFilePath);
    const fileExt = path.extname(oldPath);
    
    console.log('  oldFilePath:', oldFilePath);
    console.log('  dirPath:', dirPath);
    console.log('  fileExt:', fileExt);
    
    // Create the new filename (ensure it has the same extension)
    const sanitizedName = newName.replace(/[^a-z0-9-_]/gi, '-');
    const newFilename = `${sanitizedName}${fileExt}`;
    const newFilePath = path.join(dirPath, newFilename);
    
    console.log('  sanitizedName:', sanitizedName);
    console.log('  newFilename:', newFilename);
    console.log('  newFilePath:', newFilePath);
    
    // Check if the file exists
    if (!fs.existsSync(oldFilePath)) {
      console.log('  ERROR: Original file does not exist');
      return res.status(404).json({ error: 'Original file not found' });
    }
    
    // Check if the new filename already exists
    if (fs.existsSync(newFilePath)) {
      console.log('  ERROR: New filename already exists');
      return res.status(400).json({ error: 'A file with this name already exists' });
    }
    
    // Rename the file
    fs.renameSync(oldFilePath, newFilePath);
    console.log('  File renamed successfully');
    
    // Return the new path
    const newRelativePath = `./assets/${triggerType}/${newFilename}`;
    console.log('  newRelativePath:', newRelativePath);
    
    res.json({ 
      success: true, 
      oldPath,
      newPath: newRelativePath
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 