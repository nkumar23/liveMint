import * as easymidi from 'easymidi';

function checkMidiDevices() {
  try {
    // Get all available MIDI input devices
    const inputs = easymidi.getInputs();
    
    console.log('\n=== Available MIDI Input Devices ===');
    if (inputs.length === 0) {
      console.log('No MIDI input devices found.');
      console.log('Please connect a MIDI device and try again.');
    } else {
      console.log(`Found ${inputs.length} MIDI input device(s):`);
      inputs.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device}`);
      });
      
      console.log('\nTo use one of these devices:');
      console.log('1. Update your .env file with:');
      console.log(`   MIDI_DEVICE=${inputs[0]}`);
      console.log('2. Or update the deviceName in triggers.json');
    }
    
    // Get all available MIDI output devices
    const outputs = easymidi.getOutputs();
    
    console.log('\n=== Available MIDI Output Devices ===');
    if (outputs.length === 0) {
      console.log('No MIDI output devices found.');
    } else {
      console.log(`Found ${outputs.length} MIDI output device(s):`);
      outputs.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device}`);
      });
    }
    
    console.log('\n=== MIDI Device Test ===');
    console.log('To test if a MIDI device is working:');
    console.log('1. Connect your MIDI controller');
    console.log('2. Run: npm run test-midi');
    console.log('3. Press keys on your MIDI controller');
    console.log('   You should see MIDI messages in the console');
    
  } catch (error) {
    console.error('Error checking MIDI devices:', error);
  }
}

checkMidiDevices(); 