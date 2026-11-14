import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper function to make API calls
  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  };

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { user } = await apiCall('/auth/me');
          setUser(user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const { user, token } = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('token', token);
      localStorage.setItem('userData', JSON.stringify(user));
      setUser(user);
      setIsAuthenticated(true);

      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      toast.error(error.message || 'Login failed');
      return { success: false, error: error.message };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const { user, token } = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      localStorage.setItem('token', token);
      localStorage.setItem('userData', JSON.stringify(user));
      setUser(user);
      setIsAuthenticated(true);

      toast.success('Account created successfully!');
      return { success: true };
    } catch (error) {
      toast.error(error.message || 'Signup failed');
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUser(null);
    setIsAuthenticated(false);
    toast.success('Logged out successfully');
  };

  // API helper functions for other components
  const createMeeting = async (meetingId, title, time) => {
    try {
      const body = { meetingId, title };
      if (time) body.time = time;
      const { meeting } = await apiCall('/meetings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return meeting;
    } catch (error) {
      console.error('Failed to create meeting:', error);
      throw error;
    }
  };

  const addMeetingParticipant = async (meetingId) => {
    try {
      const { participant } = await apiCall(`/meetings/${meetingId}/participants`, {
        method: 'POST',
      });
      return participant;
    } catch (error) {
      console.error('Failed to add participant:', error);
      throw error;
    }
  };

  const saveTranscript = async (meetingId, speakerName, text) => {
    try {
      const { transcript } = await apiCall(`/meetings/${meetingId}/transcripts`, {
        method: 'POST',
        body: JSON.stringify({ speakerName, text }),
      });
      return transcript;
    } catch (error) {
      console.error('Failed to save transcript:', error);
      throw error;
    }
  };

  const getMeetingTranscript = async (meetingId) => {
    try {
      const { transcripts } = await apiCall(`/meetings/${meetingId}/transcripts`);
      return transcripts;
    } catch (error) {
      console.error('Failed to get transcripts:', error);
      throw error;
    }
  };

  const getUserMeetings = async () => {
    try {
      const { meetings } = await apiCall('/meetings');
      return meetings;
    } catch (error) {
      console.error('Failed to get user meetings:', error);
      throw error;
    }
  };

  const getUserTranscripts = async () => {
    try {
      const { transcripts } = await apiCall('/transcripts');
      return transcripts;
    } catch (error) {
      console.error('Failed to get user transcripts:', error);
      throw error;
    }
  };

  const saveDocument = async (meetingId, title, content) => {
    try {
      const { document } = await apiCall(`/meetings/${meetingId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
      return document;
    } catch (error) {
      console.error('Failed to save document:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    signup,
    logout,
    createMeeting,
    addMeetingParticipant,
    saveTranscript,
    getMeetingTranscript,
    getUserMeetings,
    getUserTranscripts,
    saveDocument,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 