import React, { useState } from 'react';
import { FiClock, FiCalendar, FiEdit, FiTrash2, FiPlus, FiUsers } from 'react-icons/fi';
import { format } from 'date-fns';

const mockHistory = [
  {
    id: 1,
    title: 'Sprint Planning',
    date: new Date('2024-01-10T10:00:00'),
    duration: '45 min',
    transcript: 'Discussed sprint goals and tasks.',
    participants: ['Alice', 'Bob', 'Carol']
  },
  {
    id: 2,
    title: 'Design Review',
    date: new Date('2024-01-12T14:00:00'),
    duration: '30 min',
    transcript: 'Reviewed new UI mockups.',
    participants: ['Alice', 'Dan', 'Eve']
  }
];

const mockScheduled = [
  {
    id: 1,
    title: 'Demo Meeting',
    date: new Date('2024-01-20T16:00:00'),
    participants: ['Alice', 'Bob']
  }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('history');
  const [scheduled, setScheduled] = useState(mockScheduled);
  const [history] = useState(mockHistory);
  const [form, setForm] = useState({ title: '', date: '', time: '', participants: '' });

  const handleSchedule = (e) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time) return;
    setScheduled([
      ...scheduled,
      {
        id: Date.now(),
        title: form.title,
        date: new Date(`${form.date}T${form.time}`),
        participants: form.participants.split(',').map(p => p.trim())
      }
    ]);
    setForm({ title: '', date: '', time: '', participants: '' });
  };

  const handleDelete = (id) => {
    setScheduled(scheduled.filter(m => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-background-color py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-text-primary mb-6">Settings</h1>
        <div className="flex space-x-1 bg-surface-color p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-primary-color text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Meeting History
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'manage'
                ? 'bg-primary-color text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Manage Meetings
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'bg-primary-color text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Schedule Meeting
          </button>
        </div>

        {/* Meeting History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.map((meeting) => (
              <div key={meeting.id} className="card">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">{meeting.title}</h3>
                    <div className="flex items-center text-sm text-text-secondary gap-4">
                      <span><FiCalendar className="inline mr-1" />{format(meeting.date, 'MMM dd, yyyy')}</span>
                      <span><FiClock className="inline mr-1" />{meeting.duration}</span>
                      <span><FiUsers className="inline mr-1" />{meeting.participants.length} participants</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-text-secondary text-sm">
                  <strong>Transcript:</strong> {meeting.transcript}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manage Meetings */}
        {activeTab === 'manage' && (
          <div className="space-y-4">
            {scheduled.length === 0 && <div className="text-text-secondary">No scheduled meetings.</div>}
            {scheduled.map((meeting) => (
              <div key={meeting.id} className="card flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">{meeting.title}</h3>
                  <div className="flex items-center text-sm text-text-secondary gap-4">
                    <span><FiCalendar className="inline mr-1" />{format(meeting.date, 'MMM dd, yyyy')}</span>
                    <span><FiClock className="inline mr-1" />{format(meeting.date, 'HH:mm')}</span>
                    <span><FiUsers className="inline mr-1" />{meeting.participants.length} participants</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary"><FiEdit /></button>
                  <button className="btn btn-danger" onClick={() => handleDelete(meeting.id)}><FiTrash2 /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule Meeting */}
        {activeTab === 'schedule' && (
          <div className="card max-w-lg mx-auto">
            <form onSubmit={handleSchedule} className="space-y-6">
              <div className="form-group">
                <label className="form-label">Meeting Title</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group flex gap-4">
                <div className="flex-1">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.time}
                    onChange={e => setForm({ ...form, time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Participants (comma separated)</label>
                <input
                  className="form-input"
                  value={form.participants}
                  onChange={e => setForm({ ...form, participants: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary w-full">
                <FiPlus /> Schedule Meeting
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
} 