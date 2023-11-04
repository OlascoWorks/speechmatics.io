const exp = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const { RealtimeSession } = require('speechmatics');
const ffmpeg = require('fluent-ffmpeg');


const app = exp();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

app.use(exp.static('public'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
    console.log('Client connected');

    let audioBuffer = [];

    socket.on('startRecording', () => {
        audioBuffer = [];
    });

    socket.on('audioData', (audioBlob) => {
        audioBuffer.push(audioBlob);
        const audioBufferConcatenated = Buffer.concat(audioBuffer);
        fs.writeFile('temp.webm', audioBufferConcatenated, (err) => {
            if (err) {
                console.error('Error saving audio data:', err);
            } else {
                console.log('Audio data saved to temp.webm');

                const session = new RealtimeSession({ apiKey: '05V8B5G6xbDH8l5wgdy6bj1wGyL0wCos' });

                session.addListener('AddTranscript', (message) => {
                    console.log('Transcript:', message.metadata.transcript);
                    socket.emit('transcript', message.metadata.transcript);
                });

                session.start({
                      transcription_config: {
                          language: 'en',
                          operating_point: 'enhanced',
                          enable_partials: false,
                          max_delay: 2,
                      },
                      audio_format: { type: 'file' },
                }).then(() => {
                    console.log('Session started successfully');
                })
                .catch((error) => {
                    console.error('Error starting session:', error);
                });

                const fileStream = fs.createReadStream('temp.webm',  { encoding: 'binary' });
                fileStream.on('data', (sample) => {
                    session.sendAudio(sample);
                    console.log("Sending audio sample")
                });

                fileStream.on('end', () => {
                    session.stop();
                });

                fileStream.on('error', (error) => {
                    console.error('Error reading the audio stream:', error);
                    process.exit(1);
                });
            }
        });
    });

    socket.on('stopRecording', () => {
        console.log('Recording stopped');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on PORT ${PORT}`);
});
