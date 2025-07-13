document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const walkieBody = document.getElementById('walkieBody');
    const screen = document.getElementById('screen');
    const talkButton = document.getElementById('talkButton');
    const powerBtn = document.getElementById('powerBtn');
    const channelUpBtn = document.getElementById('channelUpBtn');
    const channelDownBtn = document.getElementById('channelDownBtn');
    const channelNumber = document.getElementById('channelNumber');
    const volumeLevel = document.getElementById('volumeLevel');
    const status = document.getElementById('status');
    const powerLight = document.getElementById('powerLight');
    const antenna = document.getElementById('antenna');
    const lightParticles = document.getElementById('lightParticles');
    const receiveAudio = document.getElementById('receiveAudio');
    const effectsPanel = document.getElementById('effectsPanel');
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
    let mediaRecorder;
    let audioChunks = [];
    let robotPhase = 0;
    
    // Initialize
    init();
    
    function init() {
        setupAudio();
        updateUI();
        createParticles();
        
        // Set active effect button
        effectButtons.forEach(btn => {
            if (btn.dataset.active === 'true') {
                btn.classList.add('active');
            }
            
            btn.addEventListener('click', function() {
                currentEffect = this.dataset.effect;
                effectButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                updateStatus(`EFFECT: ${currentEffect.toUpperCase()}`);
                
                // Add light effect
                addButtonPressEffect(this);
                
                // Apply effect immediately
                updateAudioChain();
            });
        });
        
        // Power button
        powerBtn.addEventListener('click', function() {
            togglePower();
            addButtonPressEffect(this);
        });
        
        // Channel buttons
        channelUpBtn.addEventListener('click', function() {
            if (!isOn) return;
            changeChannel(1);
            addButtonPressEffect(this);
        });
        
        channelDownBtn.addEventListener('click', function() {
            if (!isOn) return;
            changeChannel(-1);
            addButtonPressEffect(this);
        });
        
        // Talk button events
        talkButton.addEventListener('mousedown', startTalking);
        talkButton.addEventListener('touchstart', startTalking);
        talkButton.addEventListener('mouseup', stopTalking);
        talkButton.addEventListener('touchend', stopTalking);
        talkButton.addEventListener('mouseleave', stopTalking);
    }
    
    function setupAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaStream = stream;
                    microphone = audioContext.createMediaStreamSource(stream);
                    
                    // Media recorder for playback simulation
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.ondataavailable = (e) => {
                        audioChunks.push(e.data);
                    };
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/ogg' });
                        audioChunks = [];
                        simulateReceiveAudio(audioBlob);
                    };
                    
                    // Audio processor for real-time effects
                    processor = audioContext.createScriptProcessor(4096, 1, 1);
                    processor.onaudioprocess = processAudio;
                    
                    destination = audioContext.createMediaStreamDestination();
                    updateAudioChain();
                    
                    updateStatus('READY');
                })
                .catch(err => {
                    console.error('Microphone error:', err);
                    updateStatus('MIC ERROR', true);
                });
        } catch (e) {
            console.error('Audio context error:', e);
            updateStatus('AUDIO ERROR', true);
        }
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
                // Clear effect
                for (let i = 0; i < input.length; i++) {
                    output[i] = input[i];
                }
        }
    }
    
    function applyRadioEffect(input, output) {
        for (let i = 0; i < input.length; i++) {
            output[i] = Math.tanh(input[i] * 3) * 0.6;
            output[i] += (Math.random() * 0.05 - 0.025);
            
            if (i > 0) {
                output[i] = output[i] * 0.7 + output[i-1] * 0.3;
            }
        }
    }
    
    function applyWalkieEffect(input, output) {
        for (let i = 0; i < input.length; i++) {
            let val = input[i] * 2.5;
            val = Math.max(-0.8, Math.min(0.8, val));
            output[i] = val;
            
            if (i < 10 && isTalking) {
                output[i] += (10 - i) * 0.02;
            }
        }
    }
    
    function applyRobotEffect(input, output) {
        const freq = 50;
        const sampleRate = audioContext.sampleRate;
        
        for (let i = 0; i < input.length; i++) {
            const t = (i + robotPhase) / sampleRate;
            const modulator = Math.sin(2 * Math.PI * freq * t);
            output[i] = input[i] * modulator * 3;
        }
        
        robotPhase += input.length;
    }
    
    function applyEchoEffect(input, output) {
        const delaySamples = audioContext.sampleRate * 0.3;
        const decay = 0.5;
        
        if (!this.echoBuffer || this.echoBuffer.length !== delaySamples) {
            this.echoBuffer = new Float32Array(delaySamples);
            this.echoPointer = 0;
        }
        
        for (let i = 0; i < input.length; i++) {
            const echoValue = this.echoBuffer[this.echoPointer];
            output[i] = input[i] + echoValue * decay;
            this.echoBuffer[this.echoPointer] = input[i];
            this.echoPointer = (this.echoPointer + 1) % delaySamples;
        }
    }
    
    function updateVolumeMeter(input) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
            sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        const volume = Math.min(100, Math.round(rms * 200));
        volumeLevel.style.width = `${volume}%`;
    }
    
    function updateAudioChain() {
        if (!microphone || !processor || !destination) return;
        
        microphone.disconnect();
        processor.disconnect();
        microphone.connect(processor);
        processor.connect(destination);
    }
    
    function togglePower() {
        isOn = !isOn;
        
        if (isOn) {
            powerLight.classList.add('on');
            antenna.classList.add('active');
            walkieBody.classList.add('active-screen');
            updateStatus('POWER ON');
            
            // Play power on sound
            playBeep(800, 0.1, 0.1);
        } else {
            powerLight.classList.remove('on');
            antenna.classList.remove('active');
            walkieBody.classList.remove('active-screen');
            updateStatus('POWER OFF');
            
            // Stop any current transmission
            if (isTalking) {
                stopTalking(new Event('powerOff'));
            }
            
            // Play power off sound
            playBeep(400, 0.1, 0.1);
        }
        
        // Add screen activation effect
        screen.classList.add('active');
        setTimeout(() => {
            screen.classList.remove('active');
        }, 300);
    }
    
    function changeChannel(direction) {
        currentChannel = Math.max(1, Math.min(99, currentChannel + direction));
        channelNumber.textContent = currentChannel.toString().padStart(2, '0');
        
        // Play channel change sound
        playBeep(direction > 0 ? 800 : 400, 0.05, 0.2);
        
        // Add channel change effect
        screen.classList.add('active');
        setTimeout(() => {
            screen.classList.remove('active');
        }, 200);
        
        updateStatus(`CHANNEL ${currentChannel}`);
    }
    
    function startTalking(e) {
        e.preventDefault();
        if (!isOn || isTalking) return;
        
        isTalking = true;
        talkButton.classList.add('active');
        antenna.classList.add('active');
        updateStatus('TRANSMITTING');
        
        // Add screen glow effect
        walkieBody.classList.add('active-screen');
        screen.classList.add('active');
        
        // Start recording
        if (mediaRecorder && mediaRecorder.state === 'inactive') {
            mediaRecorder.start();
        }
        
        // Play push-to-talk sound
        playBeep(1200, 0.05, 0.05);
    }
    
    function stopTalking(e) {
        e.preventDefault();
        if (!isTalking) return;
        
        isTalking = false;
        talkButton.classList.remove('active');
        walkieBody.classList.remove('active-screen');
        updateStatus(`CHANNEL ${currentChannel}`);
        
        // Stop recording
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        
        // Play release sound
        playBeep(600, 0.05, 0.05);
    }
    
    function simulateReceiveAudio(blob) {
        if (!isOn) return;
        
        const audioUrl = URL.createObjectURL(blob);
        receiveAudio.src = audioUrl;
        
        // Add receive effect
        screen.classList.add('active');
        setTimeout(() => {
            screen.classList.remove('active');
        }, 500);
        
        // Create light particles
        createLightParticles();
        
        receiveAudio.play();
        updateStatus('RECEIVING');
    }
    
    function playBeep(frequency, duration, volume) {
        if (!isOn || !audioContext) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.stop(audioContext.currentTime + duration);
    }
    
    function updateStatus(text, isError = false) {
        status.textContent = text;
        status.style.color = isError ? '#ff4d4d' : '#b8c2cc';
    }
    
    function createParticles() {
        // Create initial particles for background
        for (let i = 0; i < 20; i++) {
            createParticle(true);
        }
    }
    
    function createLightParticles() {
        // Create burst of particles for transmission/reception
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                createParticle(false);
            }, i * 50);
        }
    }
    
    function createParticle(isBackground) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const size = Math.random() * 3 + 1;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        
        if (isBackground) {
            particle.style.opacity = Math.random() * 0.1;
            particle.style.background = `rgba(58, 123, 213, ${Math.random() * 0.3})`;
            
            // Slow floating animation for background particles
            const duration = 20 + Math.random() * 30;
            const delay = Math.random() * 10;
            
            particle.style.transition = `all ${duration}s linear ${delay}s`;
            
            // Random movement
            setTimeout(() => {
                particle.style.transform = `translate(${(Math.random() - 0.5) * 100}px, ${(Math.random() - 0.5) * 100}px)`;
            }, 10);
        } else {
            particle.style.background = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
            particle.style.boxShadow = `0 0 ${Math.random() * 10 + 5}px white`;
            
            // Fast burst animation
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 100;
            const duration = 0.5 + Math.random() * 1;
            
            particle.style.transition = `all ${duration}s ease-out`;
            particle.style.opacity = '1';
            
            setTimeout(() => {
                particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
                particle.style.opacity = '0';
                
                // Remove after animation
                setTimeout(() => {
                    particle.remove();
                }, duration * 1000);
            }, 10);
        }
        
        lightParticles.appendChild(particle);
    }
    
    function addButtonPressEffect(button) {
        if (!isOn) return;
        
        // Add ripple effect
        const ripple = document.createElement('div');
        ripple.style.position = 'absolute';
        ripple.style.width = '100%';
        ripple.style.height = '100%';
        ripple.style.background = 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%';
        ripple.style.borderRadius = 'inherit';
        ripple.style.top = '0';
        ripple.style.left = '0';
        ripple.style.opacity = '0.5';
        ripple.style.transform = 'scale(0)';
        ripple.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        
        button.appendChild(ripple);
        
        // Trigger animation
        setTimeout(() => {
            ripple.style.transform = 'scale(2)';
            ripple.style.opacity = '0';
        }, 10);
        
        // Remove after animation
        setTimeout(() => {
            ripple.remove();
        }, 300);
        
        // Play button sound
        playBeep(600, 0.05, 0.1);
    }
    
    function updateUI() {
        channelNumber.textContent = currentChannel.toString().padStart(2, '0');
        
        if (isOn) {
            powerLight.classList.add('on');
            antenna.classList.add('active');
            walkieBody.classList.add('active-screen');
            powerBtn.classList.add('active');
            updateStatus(`CHANNEL ${currentChannel}`);
        } else {
            powerLight.classList.remove('on');
            antenna.classList.remove('active');
            walkieBody.classList.remove('active-screen');
            powerBtn.classList.remove('active');
            updateStatus('POWER OFF');
        }
    }
    
    // Handle window blur (stop talking if window loses focus)
    window.addEventListener('blur', function() {
        if (isTalking) {
            stopTalking(new Event('blur'));
        }
    });
});
