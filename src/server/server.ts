import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';
import * as easymidi from 'easymidi';
import fetch from 'node-fetch';

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
    const targetDir = path.join(process.cwd(), 'assets', triggerType);
    
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
    
    // Verify the file exists at the target path
    if (!fs.existsSync(targetPath)) {
      console.error(`File not found at target path after move: ${targetPath}`);
      return res.status(500).json({ error: 'File upload failed - file not found after move' });
    }
    
    // Get file stats to verify it's a valid file
    try {
      const stats = fs.statSync(targetPath);
      if (!stats.isFile()) {
        console.error(`Target path is not a file: ${targetPath}`);
        return res.status(500).json({ error: 'File upload failed - target is not a file' });
      }
      
      if (stats.size === 0) {
        console.error(`File is empty: ${targetPath}`);
        return res.status(500).json({ error: 'File upload failed - file is empty' });
      }
      
      console.log(`File verified: ${targetPath}, size: ${stats.size} bytes`);
    } catch (error) {
      console.error(`Error verifying file: ${error}`);
      return res.status(500).json({ error: 'File upload failed - error verifying file' });
    }
    
    // Update triggers.json
    try {
      const triggersPath = path.join(process.cwd(), 'triggers.json');
      const triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
      
      const triggerIndex = triggers.triggers.findIndex((t: any) => t.id === triggerId);
      
      if (triggerIndex >= 0) {
        // Update the media file path - use consistent format with ./
        triggers.triggers[triggerIndex].nftMetadata.mediaFile = `./assets/${triggerType}/${filename}`;
        fs.writeFileSync(triggersPath, JSON.stringify(triggers, null, 2));
        
        // Log the updated path
        console.log(`Updated media file path: ${triggers.triggers[triggerIndex].nftMetadata.mediaFile}`);
        
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
    const mediaDir = path.join(process.cwd(), 'assets', triggerType);
    
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
    let oldFilePath;
    if (oldPath.startsWith('./')) {
      oldFilePath = path.join(process.cwd(), oldPath.substring(2));
    } else {
      oldFilePath = path.join(process.cwd(), oldPath);
    }
    
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

// Update the webhook URLs endpoint
app.get('/api/webhook-urls', (req, res) => {
  try {
    // Read the triggers.json file
    const triggersPath = path.join(__dirname, '../../triggers.json');
    const triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
    
    // Extract IFTTT triggers and generate webhook URLs
    const webhooks = triggers.triggers
      .filter((trigger: any) => trigger.type === 'ifttt')
      .map((trigger: any) => {
        const eventName = trigger.config.eventName;
        const secretKey = trigger.config.secretKey;
        const url = `/api/webhook/ifttt/${eventName}${secretKey ? `?key=${secretKey}` : ''}`;
        
        return {
          triggerId: trigger.id,
          url
        };
      });
    
    res.json({ webhooks });
  } catch (error) {
    console.error('Error getting webhook URLs:', error);
    res.status(500).json({ error: 'Failed to get webhook URLs' });
  }
});

// Update the webhook endpoint with better error handling
app.post('/api/webhook/ifttt/:eventName', (req, res) => {
  try {
    const eventName = req.params.eventName;
    const key = req.query.key || req.headers['x-ifttt-key'];
    
    console.log(`Received webhook for event: ${eventName}`);
    console.log('Request body:', JSON.stringify(req.body));
    console.log('Request headers:', JSON.stringify(req.headers));
    
    // Try to handle the webhook directly instead of forwarding
    try {
      // Find the trigger in triggers.json
      const triggersPath = path.join(__dirname, '../../triggers.json');
      const triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
      
      const trigger = triggers.triggers.find((t: any) => 
        t.type === 'ifttt' && t.config.eventName === eventName
      );
      
      if (!trigger) {
        console.error(`No trigger found for event: ${eventName}`);
        return res.status(404).json({ error: 'Trigger not found' });
      }
      
      console.log(`Found trigger: ${trigger.id}`);
      
      // Respond to IFTTT immediately to prevent timeout
      res.json({ 
        success: true, 
        message: 'Webhook received and will be processed',
        triggerId: trigger.id
      });
      
      // Process the webhook asynchronously
      setTimeout(() => {
        try {
          // Forward to the webhook server
          fetch(`http://localhost:${process.env.WEBHOOK_PORT || 3001}/api/webhook/ifttt/${eventName}${key ? `?key=${key}` : ''}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(key ? { 'x-ifttt-key': key.toString() } : {})
            },
            body: JSON.stringify(req.body)
          })
          .then(response => response.json())
          .then(data => {
            console.log('Background response from webhook server:', data);
          })
          .catch(error => {
            console.error('Background error forwarding webhook:', error);
          });
        } catch (error) {
          console.error('Error in async webhook processing:', error);
        }
      }, 0);
      
    } catch (error) {
      console.error('Error processing webhook directly:', error);
      // Fix: Type check the error before accessing message property
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Internal server error', details: errorMessage });
    }
  } catch (error) {
    console.error('Unhandled error in webhook endpoint:', error);
    // Fix: Type check the error before accessing message property
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Internal server error', details: errorMessage });
  }
});

// Add a simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit!');
  res.json({ success: true, message: 'Test endpoint working' });
});

// Add a test endpoint to check webhook server connectivity
app.get('/api/test-webhook-server', (req, res) => {
  console.log('Testing webhook server connectivity...');
  
  fetch(`http://localhost:${process.env.WEBHOOK_PORT || 3001}/api/webhook-test`)
    .then(response => response.json())
    .then(data => {
      console.log('Webhook server response:', data);
      res.json({ 
        success: true, 
        message: 'Webhook server is reachable',
        webhookServerResponse: data
      });
    })
    .catch(error => {
      console.error('Error connecting to webhook server:', error);
      res.status(500).json({ 
        error: 'Failed to connect to webhook server',
        details: error.message
      });
    });
});

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add a utility endpoint to check if files exist
app.get('/api/check-file', (req, res) => {
  const filePath = req.query.path as string;
  
  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }
  
  console.log(`Checking if file exists: ${filePath}`);
  
  let absolutePath = filePath;
  if (filePath.startsWith('./')) {
    absolutePath = path.join(process.cwd(), filePath.substring(2));
  } else if (!path.isAbsolute(filePath)) {
    absolutePath = path.join(process.cwd(), filePath);
  }
  
  console.log(`Absolute path: ${absolutePath}`);
  
  const exists = fs.existsSync(absolutePath);
  console.log(`File exists: ${exists}`);
  
  if (exists) {
    const stats = fs.statSync(absolutePath);
    return res.json({
      exists,
      path: filePath,
      absolutePath,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      created: stats.birthtime,
      modified: stats.mtime
    });
  } else {
    // Check if the directory exists
    const dirPath = path.dirname(absolutePath);
    const dirExists = fs.existsSync(dirPath);
    
    let dirContents = [];
    if (dirExists) {
      dirContents = fs.readdirSync(dirPath);
    }
    
    return res.json({
      exists,
      path: filePath,
      absolutePath,
      directoryExists: dirExists,
      directoryPath: dirPath,
      directoryContents: dirContents
    });
  }
});

// Add an endpoint to update a trigger's media file
app.post('/api/update-trigger-media', (req, res) => {
  try {
    const { triggerId, mediaFile } = req.body;
    
    console.log(`Updating media file for trigger ${triggerId} to ${mediaFile}`);
    
    if (!triggerId || !mediaFile) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Check if the file exists
    let absolutePath;
    if (mediaFile.startsWith('./')) {
      absolutePath = path.join(process.cwd(), mediaFile.substring(2));
    } else {
      absolutePath = path.join(process.cwd(), mediaFile);
    }
    
    if (!fs.existsSync(absolutePath)) {
      console.error(`Media file not found: ${absolutePath}`);
      return res.status(404).json({ error: 'Media file not found' });
    }
    
    // Update the trigger in triggers.json
    const triggersPath = path.join(process.cwd(), 'triggers.json');
    const triggers = JSON.parse(fs.readFileSync(triggersPath, 'utf-8'));
    
    const triggerIndex = triggers.triggers.findIndex((t: any) => t.id === triggerId);
    
    if (triggerIndex < 0) {
      return res.status(404).json({ error: 'Trigger not found' });
    }
    
    // Update the media file path
    triggers.triggers[triggerIndex].nftMetadata.mediaFile = mediaFile;
    fs.writeFileSync(triggersPath, JSON.stringify(triggers, null, 2));
    
    console.log(`Updated trigger ${triggerId} with media file ${mediaFile}`);
    
    res.json({ 
      success: true, 
      triggerId,
      mediaFile
    });
  } catch (error) {
    console.error('Error updating trigger media:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to update trigger media', details: errorMessage });
  }
});

// Add an endpoint to restart a trigger
app.post('/api/restart-trigger', (req, res) => {
  try {
    const { triggerId } = req.body;
    
    console.log(`Restarting trigger ${triggerId}`);
    
    if (!triggerId) {
      return res.status(400).json({ error: 'Missing trigger ID' });
    }
    
    // Forward the request to the main application
    fetch(`http://localhost:${process.env.WEBHOOK_PORT || 3001}/api/restart-trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ triggerId })
    })
    .then(response => response.json())
    .then(data => {
      console.log(`Response from restart trigger: ${JSON.stringify(data)}`);
      res.json(data);
    })
    .catch(error => {
      console.error(`Error restarting trigger: ${error}`);
      res.status(500).json({ error: 'Failed to restart trigger' });
    });
  } catch (error) {
    console.error('Error in restart trigger endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to restart trigger', details: errorMessage });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 