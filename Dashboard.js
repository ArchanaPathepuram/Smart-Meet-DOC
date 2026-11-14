import React, { useState, useEffect } from 'react';
import { FiFileText, FiDownload, FiShare, FiCalendar, FiClock, FiUsers, FiTrash2 } from 'react-icons/fi';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('documents');
  const [meetingDocuments, setMeetingDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getUserTranscripts, getUserMeetings } = useAuth();
  const [documents, setDocuments] = useState([]);
  const { user } = useAuth();
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch meeting documents from database
  useEffect(() => {
    const fetchMeetingDocuments = async () => {
      try {
        setLoading(true);
        
        // Fetch all user transcripts
        const transcripts = await getUserTranscripts();
        
        if (transcripts && transcripts.length > 0) {
          // Group transcripts by meeting
          const meetingGroups = {};
          transcripts.forEach(transcript => {
            const meetingId = transcript.meeting_id;
            if (!meetingGroups[meetingId]) {
              meetingGroups[meetingId] = {
                id: meetingId,
                title: transcript.meeting_title || `Meeting ${meetingId}`,
                date: new Date(transcript.timestamp),
                participants: [],
                duration: 'Unknown',
                type: 'Transcript',
                size: '0 entries',
                transcripts: []
              };
            }
            meetingGroups[meetingId].transcripts.push(transcript);
            meetingGroups[meetingId].participants.push(transcript.speaker_name);
          });
          
          // Update size and remove duplicate participants
          Object.values(meetingGroups).forEach(group => {
            group.size = `${group.transcripts.length} entries`;
            group.participants = [...new Set(group.participants)];
          });
          
          setMeetingDocuments(Object.values(meetingGroups));
        } else {
          setMeetingDocuments([]);
        }
      } catch (error) {
        console.error('Error fetching meeting documents:', error);
        toast.error('Failed to load meeting documents');
        setMeetingDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingDocuments();
  }, [getUserTranscripts]);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (err) {
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  useEffect(() => {
    const fetchUpcomingMeetings = async () => {
      try {
        const meetings = await getUserMeetings();
        // Only show meetings with a future time or within the last 15 minutes
        const now = new Date();
        const upcoming = (meetings || []).filter(m => {
          if (!m.time) return false;
          const meetingTime = new Date(m.time);
          return meetingTime > now || (now - meetingTime) / 60000 <= 15;
        });
        setUpcomingMeetings(upcoming);
      } catch (error) {
        setUpcomingMeetings([]);
      }
    };
    fetchUpcomingMeetings();
  }, [getUserMeetings]);

  useEffect(() => {
    // Set initial tab from query param if present
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && (tab === 'documents' || tab === 'meetings')) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const downloadDocument = (doc) => {
    let content = '';
    if (doc.content) {
      // For saved documents
      content = doc.content;
    } else if (doc.transcripts && doc.transcripts.length > 0) {
      // For meeting documents (transcripts)
      content = doc.transcripts.map(
        t => `[${new Date(t.timestamp).toLocaleString()}] ${t.speaker_name}: ${t.text}`
      ).join('\n');
    } else {
      content = 'No content available.';
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title || 'meeting-document'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareDocument = (doc) => {
    // Mock share functionality
    console.log(`Sharing ${doc.title}`);
    toast.success('Share functionality coming soon!');
  };

  const deleteDocument = async (docId) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMeetingDocuments(prev => prev.filter(doc => doc._id !== docId));
        toast.success('Document deleted');
      } else {
        toast.error(data.error || 'Failed to delete document');
      }
    } catch (err) {
      toast.error('Failed to delete document');
    }
  };

  // Helper to check if user is host
  const isHost = (meeting) => user && meeting.host_id && user.id && (meeting.host_id === user.id || meeting.host_id === user._id || meeting.host_id.toString() === user.id.toString());

  // Delete meeting handler
  const deleteMeeting = async (meetingId) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUpcomingMeetings(prev => prev.filter(m => m.meeting_id !== meetingId));
        toast.success('Meeting deleted');
      } else {
        toast.error(data.error || 'Failed to delete meeting');
      }
    } catch (err) {
      toast.error('Failed to delete meeting');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-color py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="text-text-secondary">Loading meeting documents...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-color py-4 flex justify-center items-start bg-gradient-to-br from-white via-gray-50 to-gray-200 dark:from-black dark:via-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md mx-auto px-2">
        {/* Welcome message */}
        <div className="flex items-center space-x-3 mb-4">
          <img src={user?.avatar_url || '/default-avatar.png'} alt={user?.name} className="w-8 h-8 rounded-full border border-border-color" />
          <div>
            <h1 className="text-lg font-bold text-text-primary">Welcome, <span className="text-primary-color">{user?.name || 'User'}</span>!</h1>
            <p className="text-xs text-text-secondary">Your meetings and documents at a glance</p>
          </div>
        </div>
        <div className="mb-4">
          <h1 className="text-xl font-bold text-text-primary mb-1">Dashboard</h1>
          <p className="text-xs text-text-secondary">Manage your meetings and documents</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-surface-color p-1 rounded-lg mb-4 shadow-sm">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-primary-color text-background-color shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FiFileText className="inline mr-1" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
              activeTab === 'meetings'
                ? 'bg-primary-color text-background-color shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FiCalendar className="inline mr-1" />
            Upcoming Meetings
          </button>
        </div>

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-text-primary">Meeting Documents</h2>
              <div className="text-xs text-text-secondary">
                {meetingDocuments.length} documents
              </div>
            </div>
            {meetingDocuments.length === 0 ? (
              <div className="card text-center py-8">
                <FiFileText className="mx-auto text-3xl text-text-secondary mb-2" />
                <h3 className="text-base font-medium text-text-primary mb-1">No meeting documents yet</h3>
                <p className="text-xs text-text-secondary mb-2">
                  Your meeting transcripts will appear here after you participate in meetings with transcription enabled.
                </p>
                <button className="btn btn-primary btn-sm text-xs px-3 py-1">
                  Start a Meeting
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                {meetingDocuments.map((doc) => (
                  <div key={doc.id} className="card p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-text-primary mb-1">
                          {doc.title}
                        </h3>
                        <div className="flex items-center space-x-2 text-xs text-text-secondary mb-1">
                          <span className="flex items-center">
                            <FiCalendar className="mr-1" />
                            {format(doc.date, 'MMM dd, yyyy')}
                          </span>
                          <span className="flex items-center">
                            <FiClock className="mr-1" />
                            {doc.duration}
                          </span>
                          <span className="flex items-center">
                            <FiUsers className="mr-1" />
                            {doc.participants.length} participants
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-text-secondary">
                          <span>{doc.type}</span>
                          <span>{doc.size}</span>
                        </div>
                        {doc.transcripts && doc.transcripts.length > 0 && (
                          <div className="mt-2 p-2 bg-surface-color rounded">
                            <span className="text-xs text-text-secondary">{doc.transcripts.length} transcript entries</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-1 ml-2">
                        <button className="btn btn-xs btn-outline" onClick={() => downloadDocument(doc)} title="Download"><FiDownload /></button>
                        <button className="btn btn-xs btn-outline" onClick={() => shareDocument(doc)} title="Share"><FiShare /></button>
                        <button className="btn btn-xs btn-outline text-danger-color" onClick={() => deleteDocument(doc._id)} title="Delete"><FiTrash2 /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-text-primary">Upcoming Meetings</h2>
              <div className="text-sm text-text-secondary">
                {upcomingMeetings.length} scheduled
              </div>
            </div>
            {upcomingMeetings.length === 0 ? (
              <div className="card text-center py-12">
                <FiCalendar className="mx-auto text-4xl text-text-secondary mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">No upcoming meetings</h3>
                <p className="text-text-secondary mb-4">
                  Create a new meeting to get started.
                </p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>Create Meeting</button>
              </div>
            ) : (
              <div className="grid gap-2">
                {upcomingMeetings.map((meeting) => {
                  const meetingTime = new Date(meeting.time);
                  const now = new Date();
                  const isSoon = (meetingTime - now) / 60000 < 10 && (meetingTime - now) > 0;
                  // Allow join only if now >= meetingTime and now - meetingTime <= 15 minutes
                  const canJoin = now >= meetingTime && (now - meetingTime) / 60000 <= 15;
                  return (
                    <div key={meeting._id} className="card p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white border border-gray-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-medium text-text-primary mb-1">{meeting.title || `Meeting ${meeting.meeting_id}`}</h3>
                        <div className="flex items-center space-x-2 text-xs text-text-secondary">
                          <FiCalendar />
                          <span>{format(meetingTime, 'MMM dd, yyyy HH:mm')}</span>
                          {isSoon && <span className="ml-2 text-xs text-success-color font-semibold">Starting soon</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-text-secondary">ID: {meeting.meeting_id}</span>
                        <button
                          className="btn btn-xs btn-primary"
                          title="Join Meeting"
                          disabled={!canJoin}
                          onClick={() => {
                            if (!canJoin) {
                              toast.error('You can only join this meeting within 15 minutes after the scheduled time.');
                              return;
                            }
                            navigate(`/meeting/${meeting.meeting_id}?time=${encodeURIComponent(meeting.time)}`);
                          }}
                        >
                          Join
                        </button>
                        {isHost(meeting) && (
                          <button
                            className="btn btn-xs btn-outline text-danger-color"
                            title="Delete Meeting"
                            onClick={() => deleteMeeting(meeting.meeting_id)}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 