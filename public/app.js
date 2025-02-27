document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const triggersList = document.getElementById('triggersList');
  const addTriggerBtn = document.getElementById('addTriggerBtn');
  const saveBtn = document.getElementById('saveBtn');
  const addTriggerModal = document.getElementById('addTriggerModal');
  const closeModalBtn = document.querySelector('.close');
  const addTriggerForm = document.getElementById('addTriggerForm');
  const triggerTypeSelect = document.getElementById('triggerType');
  const midiConfig = document.getElementById('midiConfig');
  const keyboardConfig = document.getElementById('keyboardConfig');
  const footpedalConfig = document.getElementById('footpedalConfig');
  const midiDevicesList = document.getElementById('midiDevicesList');
  const midiDeviceSelect = document.getElementById('midiDevice');
  
  // State
  let triggers = { triggers: [] };
  let midiDevices = [];
  
  // Fetch triggers data
  async function fetchTriggers() {
    try {
      const response = await fetch('/api/triggers');
      triggers = await response.json();
      renderTriggers();
    } catch (error) {
      console.error('Error fetching triggers:', error);
      triggersList.innerHTML = '<p>Error loading triggers. Please try again.</p>';
    }
  }
  
  // Fetch MIDI devices
  async function fetchMidiDevices() {
    try {
      const response = await fetch('/api/midi-devices');
      const data = await response.json();
      midiDevices = data.devices;
      renderMidiDevices();
      populateMidiDeviceSelect();
    } catch (error) {
      console.error('Error fetching MIDI devices:', error);
      midiDevicesList.innerHTML = '<p>Error loading MIDI devices.</p>';
    }
  }
  
  // Fetch media files for a trigger type
  async function fetchMediaFiles(triggerType) {
    try {
      const response = await fetch(`/api/media-files/${triggerType}`);
      const data = await response.json();
      return data.files;
    } catch (error) {
      console.error('Error fetching media files:', error);
      return [];
    }
  }
  
  // Render triggers
  function renderTriggers() {
    if (!triggers.triggers || triggers.triggers.length === 0) {
      triggersList.innerHTML = '<p>No triggers configured. Add one to get started.</p>';
      return;
    }
    
    triggersList.innerHTML = triggers.triggers.map((trigger, index) => `
      <div class="trigger-card" data-id="${trigger.id}">
        <button class="delete-btn" data-index="${index}">×</button>
        <h3>
          ${trigger.id}
          <span class="trigger-type ${trigger.type}">${trigger.type}</span>
        </h3>
        
        <div class="trigger-config">
          <h4>Configuration</h4>
          ${renderConfig(trigger)}
        </div>
        
        <div class="nft-metadata">
          <h4>NFT Metadata</h4>
          <p><strong>Name:</strong> <span contenteditable="true" class="editable" data-field="name" data-index="${index}">${trigger.nftMetadata.name}</span></p>
          <p><strong>Symbol:</strong> <span contenteditable="true" class="editable" data-field="symbol" data-index="${index}">${trigger.nftMetadata.symbol}</span></p>
          <p><strong>Description:</strong> <span contenteditable="true" class="editable" data-field="description" data-index="${index}">${trigger.nftMetadata.description}</span></p>
        </div>
        
        <div class="media-preview">
          ${trigger.nftMetadata.mediaFile ? 
            `<img src="${trigger.nftMetadata.mediaFile.replace('./', '/')}" alt="NFT Media">` : 
            `<p>No media</p>`}
        </div>
        
        <div class="media-actions">
          <button class="upload-btn" data-id="${trigger.id}" data-type="${trigger.type}">Upload New Media</button>
          <button class="select-media-btn" data-id="${trigger.id}" data-type="${trigger.type}">Select Existing Media</button>
        </div>
      </div>
    `).join('');
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        triggers.triggers.splice(index, 1);
        renderTriggers();
      });
    });
    
    // Add event listeners for editable fields
    document.querySelectorAll('.editable').forEach(field => {
      field.addEventListener('blur', (e) => {
        const index = parseInt(e.target.dataset.index);
        const fieldName = e.target.dataset.field;
        triggers.triggers[index].nftMetadata[fieldName] = e.target.textContent;
      });
    });
    
    // Add event listeners for upload buttons
    document.querySelectorAll('.upload-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const triggerId = e.target.dataset.id;
        const triggerType = e.target.dataset.type;
        console.log(`Preparing to upload for trigger: ${triggerId}, type: ${triggerType}`);
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        
        fileInput.addEventListener('change', async (e) => {
          if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('triggerId', triggerId);
            formData.append('triggerType', triggerType);
            
            console.log(`Uploading file for trigger: ${triggerId}, type: ${triggerType}`);
            
            try {
              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
              });
              
              const result = await response.json();
              if (result.success) {
                console.log(`Upload successful, new path: ${result.path}`);
                // Update the trigger with the new file path
                const trigger = triggers.triggers.find(t => t.id === triggerId);
                if (trigger) {
                  trigger.nftMetadata.mediaFile = result.path;
                  renderTriggers();
                }
              }
            } catch (error) {
              console.error('Error uploading file:', error);
              alert('Failed to upload file. Please try again.');
            }
          }
        });
        
        fileInput.click();
      });
    });
    
    // Add event listeners for select media buttons
    document.querySelectorAll('.select-media-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const triggerId = e.target.dataset.id;
        const triggerType = e.target.dataset.type;
        
        // Fetch available media files
        const files = await fetchMediaFiles(triggerType);
        
        console.log('Available files for', triggerType, ':', files);
        
        if (files.length === 0) {
          alert(`No media files found for ${triggerType}. Upload some files first.`);
          return;
        }
        
        // Create and show the media selector modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        modal.innerHTML = `
          <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Select Media for ${triggerId}</h2>
            <div class="media-grid">
              ${files.map(file => `
                <div class="media-item" data-path="${file.fullPath}">
                  <img src="${file.path}" alt="${file.name}">
                  <div class="media-item-footer">
                    <p class="filename">${file.name}</p>
                    <button class="rename-btn" data-path="${file.fullPath}" data-type="${triggerType}">Rename</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener for close button
        modal.querySelector('.close').addEventListener('click', () => {
          document.body.removeChild(modal);
        });
        
        // Add event listeners for media items
        modal.querySelectorAll('.media-item').forEach(item => {
          item.addEventListener('click', () => {
            const mediaPath = item.dataset.path;
            
            // Update the trigger with the selected media file
            const trigger = triggers.triggers.find(t => t.id === triggerId);
            if (trigger) {
              trigger.nftMetadata.mediaFile = mediaPath;
              renderTriggers();
            }
            
            // Close the modal
            document.body.removeChild(modal);
          });
        });
        
        // Add event listeners for rename buttons
        modal.querySelectorAll('.rename-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the parent click event
            
            const filePath = btn.dataset.path;
            const triggerType = btn.dataset.type;
            
            // Use our custom functions instead of Node.js path module
            const ext = extname(filePath);
            const currentName = basename(filePath, ext);
            
            console.log('Renaming file:', filePath);
            console.log('Current name:', currentName);
            console.log('Extension:', ext);
            
            const newName = prompt('Enter new filename:', currentName);
            if (!newName || newName === currentName) return;
            
            console.log('New name:', newName);
            
            // Send rename request to server
            fetch('/api/rename-file', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                oldPath: filePath,
                newName,
                triggerType
              })
            })
            .then(response => response.json())
            .then(result => {
              console.log('Rename result:', result);
              if (result.success) {
                // Update any triggers using this file
                triggers.triggers.forEach(trigger => {
                  if (trigger.nftMetadata.mediaFile === result.oldPath) {
                    trigger.nftMetadata.mediaFile = result.newPath;
                  }
                });
                
                // Refresh the media selector
                document.body.removeChild(modal);
                document.querySelectorAll('.select-media-btn').forEach(btn => {
                  if (btn.dataset.id === triggerId) {
                    btn.click();
                  }
                });
              } else {
                alert(`Error: ${result.error}`);
              }
            })
            .catch(error => {
              console.error('Error renaming file:', error);
              alert('Failed to rename file. Please try again.');
            });
          });
        });
      });
    });
  }
  
  // Render config based on trigger type
  function renderConfig(trigger) {
    switch (trigger.type) {
      case 'midi':
        return `
          <p><strong>Note Number:</strong> ${trigger.config.noteNumber}</p>
          <p><strong>Device:</strong> ${trigger.config.deviceName || 'Default'}</p>
          <p><strong>Channel:</strong> ${trigger.config.channel || 'All'}</p>
        `;
      case 'keyboard':
        return `
          <p><strong>Key:</strong> ${trigger.config.key}</p>
          <p><strong>Modifiers:</strong> ${renderModifiers(trigger.config.modifiers)}</p>
        `;
      case 'footpedal':
        return `
          <p><strong>USB Device:</strong> ${trigger.config.usbDevice}</p>
        `;
      default:
        return '<p>Unknown trigger type</p>';
    }
  }
  
  // Render modifiers for keyboard triggers
  function renderModifiers(modifiers) {
    if (!modifiers) return 'None';
    
    const mods = [];
    if (modifiers.shift) mods.push('Shift');
    if (modifiers.ctrl) mods.push('Ctrl');
    if (modifiers.alt) mods.push('Alt');
    
    return mods.length > 0 ? mods.join(' + ') : 'None';
  }
  
  // Render MIDI devices
  function renderMidiDevices() {
    if (midiDevices.length === 0) {
      midiDevicesList.innerHTML = '<p>No MIDI devices found.</p>';
      return;
    }
    
    midiDevicesList.innerHTML = midiDevices.map(device => 
      `<div class="midi-device">${device}</div>`
    ).join('');
  }
  
  // Populate MIDI device select
  function populateMidiDeviceSelect() {
    midiDeviceSelect.innerHTML = midiDevices.map(device => 
      `<option value="${device}">${device}</option>`
    ).join('');
  }
  
  // Show the correct config section based on trigger type
  triggerTypeSelect.addEventListener('change', () => {
    const type = triggerTypeSelect.value;
    
    midiConfig.style.display = 'none';
    keyboardConfig.style.display = 'none';
    footpedalConfig.style.display = 'none';
    
    switch (type) {
      case 'midi':
        midiConfig.style.display = 'block';
        break;
      case 'keyboard':
        keyboardConfig.style.display = 'block';
        break;
      case 'footpedal':
        footpedalConfig.style.display = 'block';
        break;
    }
  });
  
  // Open modal
  addTriggerBtn.addEventListener('click', () => {
    addTriggerModal.style.display = 'block';
  });
  
  // Close modal
  closeModalBtn.addEventListener('click', () => {
    addTriggerModal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === addTriggerModal) {
      addTriggerModal.style.display = 'none';
    }
  });
  
  // Handle form submission
  addTriggerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const triggerId = document.getElementById('triggerId').value;
    const triggerType = document.getElementById('triggerType').value;
    
    // Create config based on trigger type
    let config = {};
    switch (triggerType) {
      case 'midi':
        config = {
          noteNumber: parseInt(document.getElementById('midiNoteNumber').value),
          deviceName: document.getElementById('midiDevice').value
        };
        break;
      case 'keyboard':
        config = {
          key: document.getElementById('keyboardKey').value
        };
        break;
      case 'footpedal':
        config = {
          usbDevice: document.getElementById('footpedalDevice').value
        };
        break;
    }
    
    // Create NFT metadata
    const nftMetadata = {
      name: document.getElementById('nftName').value,
      symbol: document.getElementById('nftSymbol').value,
      description: document.getElementById('nftDescription').value,
      mediaFile: '',
      attributes: {}
    };
    
    // Add new trigger
    triggers.triggers.push({
      id: triggerId,
      type: triggerType,
      config,
      nftMetadata
    });
    
    // Close modal and render triggers
    addTriggerModal.style.display = 'none';
    renderTriggers();
    
    // Reset form
    addTriggerForm.reset();
  });
  
  // Save changes
  saveBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/triggers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(triggers)
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Changes saved successfully!');
      } else {
        alert('Failed to save changes. Please try again.');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    }
  });
  
  // Initialize
  fetchTriggers();
  fetchMidiDevices();
});

// Add these utility functions at the top of your file
function basename(path, ext) {
  // Extract filename from path
  const filename = path.split('/').pop();
  if (!ext) return filename;
  
  // Remove extension if it matches
  if (filename.endsWith(ext)) {
    return filename.slice(0, -ext.length);
  }
  return filename;
}

function extname(path) {
  // Get the extension including the dot
  const parts = path.split('.');
  if (parts.length <= 1) return '';
  return '.' + parts.pop();
} 