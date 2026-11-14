import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiVideo, FiUsers, FiCopy, FiLink } from 'react-icons/fi';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { addMinutes, setHours, setMinutes, addDays, formatISO, format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const [meetingId, setMeetingId] = useState('');
  const [userName, setUserName] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [meetingTime, setMeetingTime] = useState('09:00 AM');
  const [customTime, setCustomTime] = useState('');
  const navigate = useNavigate();
  const { createMeeting } = useAuth();

  // Generate time options for 12-hour clock, every 15 minutes
  const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        const label = `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
        const value = `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
        options.push({ label, value, hour: h, minute: m });
      }
    }
    return options;
  };
  const timeOptions = generateTimeOptions();

  const handleTimeChange = (e) => {
    const value = e.target.value;
    if (value === 'custom') {
      setMeetingTime('custom');
    } else {
      setMeetingTime(value);
      setCustomTime('');
    }
  };

  const handleCustomTimeChange = (e) => {
    setCustomTime(e.target.value);
    setMeetingTime(e.target.value);
  };

  const createMeetingHandler = async () => {
    if (!userName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!meetingDate || !meetingTime) {
      toast.error('Please select a meeting date and time');
      return;
    }
    // Combine date and time into ISO string
    const [timeStr, ampm] = meetingTime.split(' ');
    let [hour, minute] = timeStr.split(':').map(Number);
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const dateObj = new Date(meetingDate);
    dateObj.setHours(hour, minute, 0, 0);
    const isoTime = dateObj.toISOString();
    let attempt = 0;
    let success = false;
    let lastError = null;
    while (attempt < 5 && !success) {
      const newMeetingId = uuidv4().substring(0, 8);
      try {
        console.log('Calling createMeeting with:', newMeetingId, isoTime);
        await createMeeting(newMeetingId, `Meeting ${newMeetingId}`, isoTime);
        localStorage.setItem('newMeetingId', newMeetingId);
        navigate(`/dashboard?tab=meetings`);
        success = true;
      } catch (err) {
        lastError = err;
        if (err.message && err.message.includes('duplicate key error')) {
          attempt++;
          continue; // Try again with a new ID
        } else {
          console.error('Error creating meeting:', err);
          toast.error('Failed to create meeting: ' + (err.message || err));
          return;
        }
      }
    }
    if (!success) {
      toast.error('Failed to create meeting after several attempts. Please try again.');
      if (lastError) console.error('Last error:', lastError);
    }
  };

  const joinMeeting = () => {
    if (!meetingId.trim() || !userName.trim()) {
      toast.error('Please enter meeting ID and your name');
      return;
    }
    navigate(`/meeting/${meetingId}?name=${encodeURIComponent(userName)}`);
  };
  const copyMeetingId = () => {
    if (meetingId) {
      navigator.clipboard.writeText(meetingId);
      toast.success('Meeting ID copied to clipboard!');
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-color rounded-full flex items-center justify-center mb-4">
            <FiVideo className="text-background-color text-2xl" />
          </div>
          <h2 className="text-3xl font-bold text-text-primary mb-2">
            Welcome to SmartMeet
          </h2>
          <p className="text-text-secondary">
            Create or join a video meeting
          </p>
        </div>

        <div className="card">
          <div className="space-y-6">
            <div className="form-group">
              <label htmlFor="userName" className="form-label">
                Your Name
              </label>
              <input
                id="userName"
                type="text"
                className="form-input"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="meetingDate" className="form-label">
                Meeting Date
              </label>
              <input
                id="meetingDate"
                type="date"
                className="form-input w-36"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="meetingTime" className="form-label">
                Meeting Time
              </label>
              <select
                id="meetingTime"
                className="form-input w-36"
                value={meetingTime}
                onChange={e => setMeetingTime(e.target.value)}
                required
              >
                {timeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={createMeetingHandler}
              className="btn btn-primary w-full"
            >
              <FiVideo />
              New Meeting
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-color" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface-color text-text-secondary">or join a meeting</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="meetingId" className="form-label">
                Meeting ID
              </label>
              <div className="flex gap-2">
                <input
                  id="meetingId"
                  type="text"
                  className="form-input flex-1"
                  placeholder="Enter meeting ID"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                />
                <button
                  onClick={copyMeetingId}
                  className="btn btn-icon btn-secondary"
                  title="Copy meeting ID"
                >
                  <FiCopy />
                </button>
              </div>
            </div>

            <button
              onClick={joinMeeting}
              className="btn btn-secondary w-full"
            >
              <FiLink />
              Join Meeting
            </button>
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center space-x-4 text-text-secondary">
            <div className="flex items-center space-x-2">
              <FiUsers />
              <span className="text-sm">Secure video meetings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 