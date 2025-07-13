document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const talkButton = document.getElementById('talkButton');
    const powerBtn = document.getElementById('powerBtn');
    const channelUpBtn = document.getElementById('channelUpBtn');
    const channelDownBtn = document.getElementById('channelDownBtn');
    const channelNumber = document.getElementById('channelNumber');
    const volumeLevel = document.getElementById('volumeLevel');
    const signalStrength = document.getElementById('signalStrength');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    const radioWave = document.getElementById('radioWave');
    const receiveAudio = document.getElementById('receiveAudio');
    const effectButtons = document.querySelectorAll('.effect-btn');
    
    // App State
    let isOn = true;
    let isTalking = false;
    let currentChannel = 1;
    let currentEffect = 'walkie';
    let audioContext;
    let microphone;
    let mediaStream;
    let processor;
    let destination;
    let websocket;
    let audioChunks = [];
    let mediaRecorder;
    
    // Initialize the app
    init();
    
    function init() {
        setupAudio();
        setupWebSocket();
        updateUI();
        simulateSignalStrength();
        
        // Set up effect buttons
        effectButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                currentEffect = this.dataset.effect;
                effectButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                showNotification(`Effect set to ${currentEffect}`);
            });
        });
        
        // Set the walkie effect as active by default
        document.querySelector('.effect-btn[data-effect="walkie"]').classList.add('active');
    }
    
    function setupAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Request microphone access
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaStream = stream;
                    microphone = audioContext.createMediaStreamSource(stream);
                    
                    // Create media recorder for playback simulation
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.ondataavailable = (e) => {
                        audioChunks.push(e.data);
                    };
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg' });
                        audioChunks = [];
                        
                        // In a real app, you would send this to other clients via WebSocket
                        // For demo, we'll just play it back locally with effects
                        simulateReceiveAudio(audioBlob);
                    };
                    
                    // Create audio processor for real-time effects
                    processor = audioContext.createScriptProcessor(4096, 1, 1);
                    processor.onaudioprocess = processAudio;
                    
                    destination = audioContext.createMediaStreamDestination();
                    
                    // Connect nodes based on current effect
                    updateAudioChain();
                    
                    console.log('Audio setup complete');
                })
                .catch(err => {
                    console.error('Error accessing microphone:', err);
                    showNotification('Microphone access denied', true);
                });
        } catch (e) {
            console.error('Error initializing audio context:', e);
            showNotification('Audio not supported', true);
        }
    }
    
    function updateAudioChain() {
        if (!microphone || !processor || !destination) return;
        
        // Disconnect all nodes first
        microphone.disconnect();
        processor.disconnect();
        
        // Connect based on effect
        microphone.connect(processor);
        processor.connect(destination);
        
        // For demo purposes, we're not actually streaming the processed audio
        // In a real app, you would stream the destination stream
    }
    
    function processAudio(e) {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        
        // Update volume meter
        updateVolumeMeter(input);
        
        // Apply selected effect
        switch (currentEffect) {
            case 'radio':
                applyRadioEffect(input, output);
                break;
            case 'walkie':
                applyWalkieEffect(input, output);
                break;
            case 'robot':
                applyRobotEffect(input, output);
                break;
            case 'echo':
                applyEchoEffect(input, output);
                break;
            default:
                // Clear effect - just copy input to output
                for (let i = 0; i < input.length; i++) {
                    output[i] = input[i];
                }
        }
    }
    
    function applyRadioEffect(input, output) {
        for (let i = 0; i < input.length; i++) {
            // AM radio effect with some distortion
            output[i] = Math.tanh(input[i] * 3) * 0.6;
            
            // Add some noise
            output[i] += (Math.random() * 0.05 - 0.025);
            
            // Simple band-pass effect
            if (i > 0) {
                output[i] = output[i] * 0.7 + output[i-1] * 0.3;
            }
        }
    }
    
    function applyWalkieEffect(input, output) {
        for (let i = 0; i < input.length; i++) {
            // Classic walkie-talkie effect with clipping
            let val = input[i] * 2.5;
            val = Math.max(-0.8, Math.min(0.8, val)); // Clip
            output[i] = val;
            
            // Add click at the beginning (push-to-talk sound)
            if (i < 10 && isTalking) {
                output[i] += (10 - i) * 0.02;
            }
        }
    }
    
    function applyRobotEffect(input, output) {
        const freq = 50; // Robot frequency
        const sampleRate = audioContext.sampleRate;
        
        for (let i = 0; i < input.length; i++) {
            // Ring modulation for robot effect
            const t = (i + robotPhase) / sampleRate;
            const modulator = Math.sin(2 * Math.PI * freq * t);
            output[i] = input[i] * modulator * 3;
        }
        
        robotPhase += input.length;
    }
    let robotPhase = 0;
    
    function applyEchoEffect(input, output) {
        const delaySamples = audioContext.sampleRate * 0.3; // 300ms delay
        const decay = 0.5;
        
        // Initialize echo buffer if needed
        if (!this.echoBuffer || this.echoBuffer.length !== delaySamples) {
            this.echoBuffer = new Float32Array(delaySamples);
            this.echoPointer = 0;
        }
        
        for (let i = 0; i < input.length; i++) {
            const echoValue = this.echoBuffer[this.echoPointer];
            output[i] = input[i] + echoValue * decay;
            
            // Store the new value in the echo buffer
            this.echoBuffer[this.echoPointer] = input[i];
            this.echoPointer = (this.echoPointer + 1) % delaySamples;
        }
    }
    
    function updateVolumeMeter(input) {
        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
            sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        
        // Convert to 0-100 scale
        const volume = Math.min(100, Math.round(rms * 200));
        
        // Update volume meter
        volumeLevel.style.width = `${volume}%`;
        
        // Change color based on volume
        if (volume > 80) {
            volumeLevel.style.background = '#e74c3c';
        } else if (volume > 50) {
            volumeLevel.style.background = '#f1c40f';
        } else {
            volumeLevel.style.background = 'linear-gradient(90deg, #2ecc71, #f1c40f)';
        }
    }
    
    function setupWebSocket() {
        // In a real app, you would connect to your WebSocket server here
        // For this demo, we'll simulate the connection
        
        setTimeout(() => {
            connectionStatus.textContent = "Secullar Network";
            connectionDot.classList.add('connected');
            connectionText.textContent = "Connected";
            
            showNotification(`Connected to channel ${currentChannel}`);
        }, 2000);
        
        // Simulate incoming messages
        setInterval(() => {
            if (Math.random() > 0.9 && !isTalking) {
                simulateIncomingTransmission();
            }
        }, 10000);
    }
    
    function simulateIncomingTransmission() {
        if (!isOn) return;
        
        showNotification(`Incoming transmission on channel ${currentChannel}`);
        
        // Create a synthetic radio voice message
        const synth = window.speechSynthesis;
        if (synth) {
            const utterance = new SpeechSynthesisUtterance(
                `This is a test transmission on channel ${currentChannel}. Over.`
            );
            
            // Apply some voice settings
            const voices = synth.getVoices();
            if (voices.length > 0) {
                utterance.voice = voices.find(v => v.name.includes('Male')) || voices[0];
                utterance.rate = 0.9;
                utterance.pitch = 0.8;
            }
            
            // Create a media stream from the speech synthesis
            const audioStream = new MediaStream();
            const audioTrack = new MediaStreamTrack();
            audioStream.addTrack(audioTrack);
            
            // Play with walkie-talkie effect
            const effectSource = audioContext.createMediaStreamSource(audioStream);
            const effectProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            effectProcessor.onaudioprocess = function(e) {
                const input = e.inputBuffer.getChannelData(0);
                const output = e.outputBuffer.getChannelData(0);
                applyWalkieEffect(input, output);
            };
            
            effectSource.connect(effectProcessor);
            effectProcessor.connect(audioContext.destination);
            
            synth.speak(utterance);
        }
    }
    
    function simulateReceiveAudio(blob) {
        if (!isOn) return;
        
        const audioUrl = URL.createObjectURL(blob);
        receiveAudio.src = audioUrl;
        
        // Apply effect based on current setting
        switch (currentEffect) {
            case 'radio':
                receiveAudio.playbackRate = 1.0;
                receiveAudio.preservesPitch = false;
                break;
            case 'walkie':
                receiveAudio.playbackRate = 1.0;
                receiveAudio.preservesPitch = true;
                break;
            case 'robot':
                receiveAudio.playbackRate = 0.8;
                receiveAudio.preservesPitch = false;
                break;
            case 'echo':
                receiveAudio.playbackRate = 1.0;
                receiveAudio.preservesPitch = true;
                break;
            default:
                receiveAudio.playbackRate = 1.0;
                receiveAudio.preservesPitch = true;
        }
        
        receiveAudio.play();
        
        // Show radio wave animation
        createRadioWave();
    }
    
    function createRadioWave() {
        const wave = document.createElement('div');
        wave.classList.add('wave', 'active-wave');
        radioWave.appendChild(wave);
        
        // Remove after animation completes
        setTimeout(() => {
            wave.remove();
        }, 2000);
    }
    
    function simulateSignalStrength() {
        const bars = signalStrength.querySelectorAll('.signal-bar');
        
        setInterval(() => {
            const strength = Math.floor(Math.random() * 6); // 0-5
            
            bars.forEach((bar, index) => {
                if (index < strength) {
                    bar.style.backgroundColor = '#2ecc71';
                    bar.style.height = `${15 + index * 5}px`;
                } else {
                    bar.style.backgroundColor = '#95a5a6';
                    bar.style.height = '15px';
                }
            });
        }, 2000);
    }
    
    function showNotification(message, isError = false) {
        if (isError) {
            notification.style.backgroundColor = '#e74c3c';
        } else {
            notification.style.backgroundColor = '#3498db';
        }
        
        notificationText.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    function updateUI() {
        // Update channel display
        channelNumber.textContent = currentChannel.toString().padStart(2, '0');
        
        // Update power button
        if (isOn) {
            powerBtn.innerHTML = '<i class="fas fa-power-off"></i>';
            powerBtn.classList.add('active');
        } else {
            powerBtn.innerHTML = '<i class="fas fa-power-off"></i>';
            powerBtn.classList.remove('active');
        }
    }
    
    // Event Listeners
    talkButton.addEventListener('mousedown', startTalking);
    talkButton.addEventListener('touchstart', startTalking);
    talkButton.addEventListener('mouseup', stopTalking);
    talkButton.addEventListener('touchend', stopTalking);
    talkButton.addEventListener('mouseleave', stopTalking);
    
    powerBtn.addEventListener('click', togglePower);
    channelUpBtn.addEventListener('click', channelUp);
    channelDownBtn.addEventListener('click', channelDown);
    
    function startTalking(e) {
        e.preventDefault();
        if (!isOn || isTalking) return;
        
        isTalking = true;
        talkButton.classList.add('active');
        showNotification(`Transmitting on channel ${currentChannel}`);
        
        // Start recording
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
            mediaRecorder.start();
        }
        
        // Create radio wave effect
        createRadioWave();
    }
    
    function stopTalking(e) {
        e.preventDefault();
        if (!isTalking) return;
        
        isTalking = false;
        talkButton.classList.remove('active');
        showNotification(`Listening on channel ${currentChannel}`);
        
        // Stop recording
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
    }
    
    function togglePower() {
        isOn = !isOn;
        
        if (isOn) {
            showNotification(`Power ON - Channel ${currentChannel}`);
            connectionDot.classList.add('connected');
            connectionText.textContent = "Connected";
        } else {
            showNotification("Power OFF", true);
            connectionDot.classList.remove('connected');
            connectionText.textContent = "Disconnected";
            
            // Stop any current transmission
            if (isTalking) {
                stopTalking(new Event('forced'));
            }
        }
        
        updateUI();
    }
    
    function channelUp() {
        if (!isOn) return;
        
        currentChannel = Math.min(99, currentChannel + 1);
        updateUI();
        showNotification(`Switched to channel ${currentChannel}`);
        
        // Simulate channel change noise
        if (audioContext) {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gain.gain.value = 0.1;
            
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            
            oscillator.start();
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    }
    
    function channelDown() {
        if (!isOn) return;
        
        currentChannel = Math.max(1, currentChannel - 1);
        updateUI();
        showNotification(`Switched to channel ${currentChannel}`);
        
        // Simulate channel change noise
        if (audioContext) {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 400;
            gain.gain.value = 0.1;
            
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            
            oscillator.start();
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    }
    
    // Handle window blur (stop talking if window loses focus)
    window.addEventListener('blur', function() {
        if (isTalking) {
            stopTalking(new Event('blur'));
        }
    });
});
