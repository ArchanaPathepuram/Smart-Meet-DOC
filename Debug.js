import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const Debug = () => {
  const { login, isAuthenticated, user } = useAuth();
  const [transcript, setTranscript] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [browserSupport, setBrowserSupport] = useState({
    speechRecognition: false,
    webkitSpeechRecognition: false
  });

  useEffect(() => {
    // Check browser support
    setBrowserSupport({
      speechRecognition: 'SpeechRecognition' in window,
      webkitSpeechRecognition: 'webkitSpeechRecognition' in window
    });
  }, []);

  const testLogin = async () => {
    try {
      console.log('Testing login...');
      const result = await login('demo@smartmeet.com', 'password');
      console.log('Login result:', result);
      toast.success(`Login test: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('Login test error:', error);
      toast.error(`Login test error: ${error.message}`);
    }
  };

  const testTranscription = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsTranscribing(true);
      setTranscript(prev => [...prev, { id: Date.now(), text: 'Transcription started', type: 'system' }]);
      toast.success('Transcription started');
    };
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setTranscript(prev => [...prev, { id: Date.now(), text: finalTranscript, type: 'speech' }]);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Transcription error:', event.error);
      setTranscript(prev => [...prev, { id: Date.now(), text: `Error: ${event.error}`, type: 'error' }]);
      toast.error(`Transcription error: ${event.error}`);
      setIsTranscribing(false);
    };
    
    recognition.onend = () => {
      setIsTranscribing(false);
      setTranscript(prev => [...prev, { id: Date.now(), text: 'Transcription ended', type: 'system' }]);
    };
    
    try {
      recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      toast.error(`Error starting recognition: ${error.message}`);
    }
  };

  const stopTranscription = () => {
    // This would need to be implemented with a ref to the recognition instance
    setIsTranscribing(false);
    setTranscript(prev => [...prev, { id: Date.now(), text: 'Transcription stopped manually', type: 'system' }]);
  };

  return (
    <div className="min-h-screen bg-background-color p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Panel</h1>
        
        {/* Authentication Status */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
          <p><strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'None'}</p>
          <button onClick={testLogin} className="btn btn-primary mt-4">
            Test Login
          </button>
        </div>

        {/* Browser Support */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Browser Support</h2>
          <p><strong>SpeechRecognition:</strong> {browserSupport.speechRecognition ? '✅ Supported' : '❌ Not Supported'}</p>
          <p><strong>webkitSpeechRecognition:</strong> {browserSupport.webkitSpeechRecognition ? '✅ Supported' : '❌ Not Supported'}</p>
          <p><strong>HTTPS/Localhost:</strong> {window.location.protocol === 'https:' || window.location.hostname === 'localhost' ? '✅ Secure Context' : '❌ Not Secure'}</p>
        </div>

        {/* Transcription Test */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Transcription Test</h2>
          <div className="flex gap-4 mb-4">
            <button 
              onClick={testTranscription} 
              disabled={isTranscribing}
              className="btn btn-success"
            >
              {isTranscribing ? 'Transcribing...' : 'Start Transcription'}
            </button>
            <button 
              onClick={stopTranscription} 
              disabled={!isTranscribing}
              className="btn btn-danger"
            >
              Stop Transcription
            </button>
          </div>
          
          <div className="bg-gray-100 p-4 rounded-lg max-h-64 overflow-y-auto">
            <h3 className="font-semibold mb-2">Transcript:</h3>
            {transcript.length === 0 ? (
              <p className="text-gray-500">No transcript yet. Click "Start Transcription" and speak.</p>
            ) : (
              transcript.map((item) => (
                <div key={item.id} className={`mb-2 p-2 rounded ${
                  item.type === 'system' ? 'bg-blue-100' : 
                  item.type === 'error' ? 'bg-red-100' : 
                  'bg-white'
                }`}>
                  <span className="text-xs text-gray-500">{new Date(item.id).toLocaleTimeString()}</span>
                  <span className="ml-2">{item.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Console Log */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <div className="space-y-2 text-sm">
            <p>1. <strong>Login Test:</strong> Click "Test Login" to verify authentication works</p>
            <p>2. <strong>Transcription Test:</strong> Click "Start Transcription" and speak into your microphone</p>
            <p>3. <strong>Browser Console:</strong> Open F12 and check for any JavaScript errors</p>
            <p>4. <strong>Microphone Permission:</strong> Make sure to allow microphone access when prompted</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Debug; 