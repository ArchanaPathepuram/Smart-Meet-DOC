import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhone, FiMessageSquare, FiUsers, FiShare, FiFileText, FiDownload, FiMail, FiEdit3, FiUpload, FiFile, FiX, FiMonitor, FiType } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Peer from 'peerjs';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_SERVER_URL = 'https://meetdoc-socket-server.onrender.com'; // Use your own or a public socket server
const PEER_SERVER_CONFIG = { host: 'peerjs.com', secure: true, port: 443 }; // Use your own PeerJS server for production

const Meeting = () => {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, createMeeting, addMeetingParticipant, saveTranscript, saveDocument } = useAuth();
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Transcription and chat state
  const [transcript, setTranscript] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [notes, setNotes] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  const [sharedFiles, setSharedFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [presentedFile, setPresentedFile] = useState(null);
  const [presenter, setPresenter] = useState(null);
  
  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const screenStreamRef = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const peersRef = useRef({});
  const mediaRecorderRef = useRef();
  const recognitionRef = useRef(null);

  const userName = user?.name || searchParams.get('name') || 'Anonymous';
  const meetingTime = searchParams.get('time');
  const [tooEarly, setTooEarly] = useState(false);

  // Initialize meeting in database
  useEffect(() => {
    if (meetingTime && new Date(meetingTime) > new Date()) {
      setTooEarly(true);
      toast.error('You can only join this meeting at or after the scheduled time.');
      return;
    }
    setTooEarly(false);
    const initializeMeeting = async () => {
      if (user && meetingId) {
        try {
          await createMeeting(meetingId, `Meeting ${meetingId}`, meetingTime);
          await addMeetingParticipant(meetingId);
          console.log('Meeting initialized in database');
        } catch (error) {
          console.error('Failed to initialize meeting:', error);
        }
      }
    };

    initializeMeeting();
  }, [user, meetingId, createMeeting, addMeetingParticipant]);

  useEffect(() => {
    // 1. Connect to socket server
    socketRef.current = io(SOCKET_SERVER_URL);
    // 2. Create PeerJS instance
    peerRef.current = new Peer(undefined, PEER_SERVER_CONFIG);

    // 3. Get local media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setParticipants([{
        id: 'local',
        name: userName,
        stream: stream,
        isLocal: true,
        joinTime: new Date()
      }]);

      // Start transcription if enabled
      if (isTranscriptionEnabled) {
        startTranscription();
      }

      // 4. When PeerJS is ready, join the room
      peerRef.current.on('open', (id) => {
        socketRef.current.emit('join-room', { roomId: meetingId, peerId: id, name: userName });
      });

      // 5. Answer incoming calls
      peerRef.current.on('call', call => {
        call.answer(stream);
        call.on('stream', remoteStream => {
          addParticipant(call.peer, remoteStream, false);
        });
      });
    });

    // 6. Listen for new users
    socketRef.current.on('user-connected', ({ peerId, name }) => {
      // Call the new user
      const call = peerRef.current.call(peerId, localStreamRef.current);
      call.on('stream', remoteStream => {
        addParticipant(peerId, remoteStream, false, name);
      });
      peersRef.current[peerId] = call;
    });

    // 7. Remove user on disconnect
    socketRef.current.on('user-disconnected', ({ peerId }) => {
      if (peersRef.current[peerId]) {
        peersRef.current[peerId].close();
        delete peersRef.current[peerId];
      }
      setParticipants(prev => prev.filter(p => p.id !== peerId));
    });

    // Listen for shared files from others
    socketRef.current.on('file-shared', (fileMeta) => {
      setSharedFiles(prev => [...prev, fileMeta]);
    });

    // Listen for file presentation
    socketRef.current.on('file-presented', ({ file, presenter }) => {
      setPresentedFile(file);
      setPresenter(presenter);
    });

    // 8. Clean up
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (peerRef.current) peerRef.current.destroy();
      if (socketRef.current) socketRef.current.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line
  }, []);

  // Handle transcription state changes
  useEffect(() => {
    if (isTranscriptionEnabled && localStreamRef.current) {
      startTranscription();
    } else if (!isTranscriptionEnabled && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [isTranscriptionEnabled]);

  // Add participant to grid
  const addParticipant = (id, stream, isLocal = false, name = 'Guest') => {
    setParticipants(prev => {
      if (prev.find(p => p.id === id)) return prev;
      return [...prev, { id, name, stream, isLocal, joinTime: new Date() }];
    });
  };

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setParticipants([{
        id: 'local',
        name: userName,
        stream: stream,
        isLocal: true,
        joinTime: new Date()
      }]);
      
      toast.success('Camera and microphone enabled');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error('Unable to access camera/microphone');
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const startTranscription = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setTranscript([{ id: 0, speaker: 'System', text: 'Live transcription not supported in this browser. Please use Chrome or Edge.', timestamp: new Date() }]);
      toast.error('Transcription not supported in this browser');
      return;
    }
    
    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      console.log('Transcription started');
      setTranscript(prev => ([...prev, { id: Date.now(), speaker: 'System', text: 'Transcription started. Start speaking...', timestamp: new Date() }]));
    };
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        console.log('Transcription result:', finalTranscript);
        const transcriptEntry = { id: Date.now(), speaker: userName, text: finalTranscript, timestamp: new Date() };
        setTranscript(prev => ([...prev, transcriptEntry]));
        
        // Save transcript to database
        if (user && meetingId) {
          saveTranscript(meetingId, userName, finalTranscript).catch(error => {
            console.error('Failed to save transcript to database:', error);
          });
        }
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Transcription error:', event.error);
      
      // Don't show error for 'aborted' as it's usually temporary
      if (event.error !== 'aborted') {
        setTranscript(prev => ([...prev, { id: Date.now(), speaker: 'System', text: 'Transcription error: ' + event.error, timestamp: new Date() }]));
        toast.error('Transcription error: ' + event.error);
      }
      
      // If it's a fatal error, stop trying to restart
      if (event.error === 'not-allowed' || event.error === 'network') {
        setIsTranscriptionEnabled(false);
        recognitionRef.current = null;
      }
    };
    
    recognition.onend = () => {
      console.log('Transcription ended, restarting...');
      
      // Only restart if transcription is still enabled
      if (isTranscriptionEnabled && recognitionRef.current === recognition) {
        setTimeout(() => {
          if (isTranscriptionEnabled) {
            try {
              recognition.start();
            } catch (error) {
              console.error('Failed to restart transcription:', error);
              setIsTranscriptionEnabled(false);
              recognitionRef.current = null;
            }
          }
        }, 100); // Small delay before restarting
      }
    };
    
    try {
      recognition.start();
      recognitionRef.current = recognition;
      console.log('Transcription recognition started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      toast.error('Failed to start transcription: ' + error.message);
      setIsTranscriptionEnabled(false);
    }
  };

  const toggleTranscription = () => {
    if (isTranscriptionEnabled) {
      // Stop transcription
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsTranscriptionEnabled(false);
      toast.success('Transcription disabled');
    } else {
      // Start transcription
      setIsTranscriptionEnabled(true);
      startTranscription();
      toast.success('Transcription enabled');
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        toast.success(audioTrack.enabled ? 'Microphone enabled' : 'Microphone disabled');
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        toast.success(videoTrack.enabled ? 'Camera enabled' : 'Camera disabled');
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        console.log('Starting screen share...');
        
        // Request screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: false
        });
        
        // Store the screen stream
        screenStreamRef.current = screenStream;
        
        // Get the video track from screen stream
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        
        if (!screenVideoTrack) {
          throw new Error('No video track found in screen stream');
        }
        
        // Replace the video track in all peer connections
        if (peerRef.current) {
          const senders = peerRef.current.getSenders();
          const videoSender = senders.find(sender => sender.track?.kind === 'video');
          
          if (videoSender) {
            await videoSender.replaceTrack(screenVideoTrack);
            console.log('Screen video track replaced in peer connection');
          }
        }
        
        // Update local video to show screen
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        // Handle screen stream ending (user clicks "Stop sharing")
        screenVideoTrack.onended = () => {
          console.log('Screen sharing ended by user');
          stopScreenSharing();
        };
        
        setIsScreenSharing(true);
        toast.success('Screen sharing started');
        
      } else {
        // Stop screen sharing
        stopScreenSharing();
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Screen sharing permission denied. Please allow screen sharing when prompted.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No screen or window found to share.');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Screen sharing is not supported in this browser.');
      } else {
        toast.error(`Screen sharing failed: ${error.message}`);
      }
    }
  };

  const stopScreenSharing = async () => {
    try {
      console.log('Stopping screen share...');
      
      // Stop all tracks in screen stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        screenStreamRef.current = null;
      }
      
      // Restore camera video
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      
      // Replace screen track with camera track in peer connections
      if (peerRef.current && localStreamRef.current) {
        const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (cameraVideoTrack) {
          const senders = peerRef.current.getSenders();
          const videoSender = senders.find(sender => sender.track?.kind === 'video');
          
          if (videoSender) {
            await videoSender.replaceTrack(cameraVideoTrack);
            console.log('Camera video track restored in peer connection');
          }
        }
      }
      
      setIsScreenSharing(false);
      toast.success('Screen sharing stopped');
      
    } catch (error) {
      console.error('Error stopping screen share:', error);
      toast.error('Error stopping screen sharing');
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const startRecording = () => {
    if (localStreamRef.current) {
      const mediaRecorder = new MediaRecorder(localStreamRef.current);
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-recording-${meetingId}.webm`;
        a.click();
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.success('Recording started');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Recording stopped and downloaded');
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        sender: userName,
        text: newMessage,
        timestamp: new Date()
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');
    }
  };

  const generateDocument = async () => {
    const meetingData = {
      title: `Meeting: ${meetingId}`,
      date: new Date(),
      participants: participants.map(p => p.name),
      transcript: transcript,
      notes: notes,
      duration: '45 minutes'
    };
    
    const documentContent = `
Meeting Summary
==============

Title: ${meetingData.title}
Date: ${format(meetingData.date, 'MMM dd, yyyy HH:mm')}
Duration: ${meetingData.duration}
Participants: ${meetingData.participants.join(', ')}

Transcript:
${meetingData.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')}

Notes:
${meetingData.notes}

Action Items:
- Follow up on project timeline
- Schedule next meeting
- Review deliverables
    `;
    
    // Only save to backend, do not download
    try {
      await saveDocument(meetingId, meetingData.title, documentContent);
      toast.success('Meeting document generated and saved!');
    } catch (err) {
      toast.error('Failed to save document to backend.');
    }
  };

  // Pause all media tracks (audio/video) without stopping them
  const pauseAllMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
      localStreamRef.current.getVideoTracks().forEach(track => track.enabled = false);
    }
  };

  const leaveMeeting = () => {
    // Pause all media tracks before stopping
    pauseAllMedia();
    // Explicitly stop local stream (camera/mic)
    stopLocalStream();

    // Stop screen sharing if active
    if (isScreenSharing) {
      stopScreenSharing();
    }
    
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Stop transcription if active
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer && peer.close) {
        peer.close();
      }
    });
    peersRef.current = {};
    
    // Disconnect from socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Destroy peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    // Clear video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Reset all states
    setParticipants([]);
    setIsAudioEnabled(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setIsTranscriptionEnabled(false);
    setIsRecording(false);
    
    navigate('/');
    toast.success('Left meeting - all media streams stopped');
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // For demo: read as data URL and broadcast meta
    const reader = new FileReader();
    reader.onload = () => {
      const fileMeta = {
        name: file.name,
        type: file.type,
        url: reader.result,
        uploadedBy: userName,
        uploadedAt: new Date().toISOString(),
      };
      setSharedFiles(prev => [...prev, fileMeta]);
      socketRef.current.emit('share-file', fileMeta);
    };
    reader.readAsDataURL(file);
  };

  const handlePresentFile = (file) => {
    socketRef.current.emit('present-file', { file, presenter: userName });
    setPresentedFile(file);
    setPresenter(userName);
  };

  const handleStopPresenting = () => {
    socketRef.current.emit('present-file', { file: null, presenter: null });
    setPresentedFile(null);
    setPresenter(null);
  };

  if (tooEarly) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Meeting Not Started</h2>
          <p className="text-text-secondary mb-2">You can only join this meeting at or after the scheduled time.</p>
          {meetingTime && (
            <p className="text-text-secondary">Scheduled for: {format(new Date(meetingTime), 'MMM dd, yyyy HH:mm')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto my-8 h-[600px] bg-background-color flex flex-col rounded-lg shadow-lg">
      {/* Meeting Header */}
      <div className="bg-surface-color border-b border-border-color p-3 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <h1 className="text-base font-semibold text-text-primary">
              Meeting: {meetingId}
            </h1>
            {meetingTime && (
              <span className="text-text-secondary text-xs bg-gray-100 px-2 py-1 rounded-full">
                {format(new Date(meetingTime), 'MMM dd, yyyy HH:mm')}
              </span>
            )}
            <span className="text-text-secondary text-xs bg-gray-100 px-2 py-1 rounded-full">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
            {isRecording && (
              <span className="bg-danger-color text-white px-2 py-1 rounded text-xs font-medium">
                REC
              </span>
            )}
            {isTranscriptionEnabled && (
              <span className="bg-success-color text-white px-2 py-1 rounded text-xs font-medium">
                LIVE
              </span>
            )}
            {isScreenSharing && (
              <span className="bg-warning-color text-white px-2 py-1 rounded text-xs font-medium">
                SCREEN
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => setShowParticipants(!showParticipants)}
              className={`btn btn-icon ${showParticipants ? 'btn-primary' : 'btn-secondary'}`}
              title="Participants"
            >
              <FiUsers />
            </button>
            <button 
              onClick={() => setShowChat(!showChat)}
              className={`btn btn-icon ${showChat ? 'btn-primary' : 'btn-secondary'}`}
              title="Chat"
            >
              <FiMessageSquare />
            </button>
            <button 
              onClick={() => setShowNotes(!showNotes)}
              className={`btn btn-icon ${showNotes ? 'btn-primary' : 'btn-secondary'}`}
              title="Live Transcript"
            >
              <FiEdit3 />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className={`flex-1 p-3 overflow-hidden ${showChat || showNotes || showParticipants ? 'w-2/3' : 'w-full'}`}>
          {presentedFile ? (
            <div className="flex h-full">
              {/* Video grid as sidebar */}
              <div className="w-1/4 p-2 border-r border-border-color bg-surface-color overflow-y-auto">
                <div className="text-text-secondary text-xs mb-2 font-medium">Video Participants</div>
                <div className="grid grid-cols-1 gap-2">
                  {participants.map((participant) => (
                    <div key={participant.id} className="video-container relative">
                      <video
                        ref={participant.isLocal ? localVideoRef : undefined}
                        autoPlay
                        muted={participant.isLocal}
                        playsInline
                        className="w-full h-24 object-cover rounded-lg"
                        srcObject={participant.stream}
                      />
                      <div className="video-overlay">
                        <div className="flex items-center space-x-1">
                          <div className="w-5 h-5 bg-primary-color rounded-full flex items-center justify-center text-xs font-bold text-white">
                            {participant.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium truncate max-w-[80px]" title={participant.name}>
                            {participant.name} {participant.isLocal && '(You)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Presented file in main area */}
              <div className="flex-1 flex flex-col items-center justify-center bg-background-color p-4">
                <div className="flex items-center justify-between w-full mb-3">
                  <h2 className="text-lg font-bold text-text-primary">Presenting: {presentedFile.name}</h2>
                  {presenter === userName && (
                    <button className="btn btn-danger text-sm" onClick={handleStopPresenting}>Stop Presenting</button>
                  )}
                </div>
                <div className="w-full max-w-4xl h-[70vh] bg-white rounded-lg shadow-lg flex items-center justify-center">
                  {presentedFile.type.includes('pdf') ? (
                    <iframe src={presentedFile.url} title="PDF Preview" className="w-full h-full rounded-lg" />
                  ) : presentedFile.type.includes('image') ? (
                    <img src={presentedFile.url} alt={presentedFile.name} className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <a href={presentedFile.url} download={presentedFile.name} className="btn btn-primary">Download {presentedFile.name}</a>
                  )}
                </div>
                <div className="mt-3 text-text-secondary text-sm">Presented by {presenter}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 h-full">
              {participants.map((participant) => (
                <div key={participant.id} className="video-container relative">
                  <video
                    ref={participant.isLocal ? localVideoRef : undefined}
                    autoPlay
                    muted={participant.isLocal}
                    playsInline
                    className="w-40 h-28 object-cover"
                    srcObject={participant.stream}
                  />
                  <div className="video-overlay">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-primary-color rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[120px]" title={participant.name}>
                        {participant.name} {participant.isLocal && '(You)'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {(showChat || showNotes || showParticipants) && (
          <div className="w-1/3 bg-surface-color border-l border-border-color flex flex-col shadow-lg">
            {/* Chat */}
            {showChat && (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border-color">
                  <h3 className="text-base font-semibold text-text-primary">Chat</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.map((message) => (
                    <div key={message.id} className="bg-background-color p-3 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-text-primary text-sm">{message.sender}</span>
                        <span className="text-xs text-text-secondary">
                          {format(message.timestamp, 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-text-primary text-sm">{message.text}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border-color">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 form-input text-sm"
                    />
                    <button onClick={sendMessage} className="btn btn-primary text-sm">
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {showNotes && (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border-color">
                  <h3 className="text-base font-semibold text-text-primary">Live Transcript</h3>
                </div>
                <div className="flex-1 p-3 overflow-y-auto">
                  {transcript.map((t) => (
                    <div key={t.id} className="mb-2 p-2 bg-background-color rounded-lg">
                      <span className="font-bold text-primary-color text-sm">{t.speaker}:</span> 
                      <span className="text-sm ml-1">{t.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participants */}
            {showParticipants && (
              <div className="flex-1 flex flex-col">
                <div className="p-3 border-b border-border-color">
                  <h3 className="text-base font-semibold text-text-primary">Participants</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-2 py-2">
                      <div className="w-6 h-6 bg-primary-color rounded-full flex items-center justify-center text-xs font-bold text-white">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate max-w-[120px]" title={participant.name}>
                          {participant.name} {participant.isLocal && '(You)'}
                        </p>
                        <p className="text-xs text-text-secondary">Joined {format(participant.joinTime, 'HH:mm')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shared Files */}
            {showParticipants && (
              <div className="flex-1 flex flex-col border-t border-border-color">
                <div className="p-3 border-b border-border-color flex justify-between items-center">
                  <h3 className="text-base font-semibold text-text-primary">Shared Files</h3>
                  <label className="btn btn-icon btn-secondary cursor-pointer text-sm">
                    <FiUpload />
                    <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" />
                  </label>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {sharedFiles.length === 0 && <div className="text-text-secondary text-sm">No files shared yet.</div>}
                  {sharedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-background-color p-2 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                      <FiFile className="text-primary-color" />
                      <span className="flex-1 truncate text-sm" onClick={() => setPreviewFile(file)}>{file.name}</span>
                      <span className="text-xs text-text-secondary">{file.uploadedBy}</span>
                      <button className="btn btn-icon btn-secondary ml-1 text-sm" title="Present to all" onClick={() => handlePresentFile(file)}>
                        <FiMonitor />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <button
          onClick={toggleAudio}
          className={`btn btn-icon ${isAudioEnabled ? 'btn-secondary' : 'btn-danger'}`}
          title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioEnabled ? <FiMic /> : <FiMicOff />}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`btn btn-icon ${isVideoEnabled ? 'btn-secondary' : 'btn-danger'}`}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? <FiVideo /> : <FiVideoOff />}
        </button>
        
        <button
          onClick={toggleScreenShare}
          className={`btn btn-icon ${isScreenSharing ? 'btn-success' : 'btn-secondary'}`}
          title={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
        >
          <FiShare />
        </button>

        <button
          onClick={toggleTranscription}
          className={`btn btn-icon ${isTranscriptionEnabled ? 'btn-success' : 'btn-secondary'}`}
          title={isTranscriptionEnabled ? 'Transcription enabled' : 'Transcription disabled'}
        >
          <FiType />
        </button>

        <button
          onClick={toggleRecording}
          className={`btn btn-icon ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <FiFileText />
        </button>

        <button
          onClick={generateDocument}
          className="btn btn-success text-sm"
          title="Generate meeting document"
        >
          <FiDownload />
          Generate Doc
        </button>
        
        <button
          onClick={leaveMeeting}
          className="btn btn-danger text-sm"
          title="Leave meeting"
        >
          <FiPhone />
          Leave
        </button>
      </div>

      {/* File Preview */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full relative">
            <button className="absolute top-2 right-2 btn btn-icon btn-danger" onClick={() => setPreviewFile(null)}><FiX /></button>
            <h2 className="text-lg font-bold mb-4">{previewFile.name}</h2>
            {previewFile.type.includes('pdf') ? (
              <iframe src={previewFile.url} title="PDF Preview" className="w-full h-96 rounded" />
            ) : previewFile.type.includes('image') ? (
              <img src={previewFile.url} alt={previewFile.name} className="w-full h-96 object-contain rounded" />
            ) : (
              <a href={previewFile.url} download={previewFile.name} className="btn btn-primary">Download {previewFile.name}</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Meeting; 