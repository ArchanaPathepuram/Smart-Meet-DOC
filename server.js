const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./src/database/db');
const Database = require('./src/database/db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'build')));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await db.createUser(name, email, password);
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message === 'Email already exists') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Login failed: Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('Attempting to authenticate user:', email);
    const user = await db.authenticateUser(email, password);
    console.log('User authenticated successfully:', user.id);
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', user.email);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error.message);
    if (error.message === 'User not found' || error.message === 'Invalid password') {
      res.status(401).json({ error: 'Invalid email or password' });
    } else {
      res.status(500).json({ error: 'Login failed: ' + error.message });
    }
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Create meeting (use authenticated user as host)
app.post('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const { meetingId, title, time } = req.body;
    const hostId = req.user.id;
    const newMeeting = await db.createMeeting(meetingId, title, hostId, time);
    res.json({ meeting: newMeeting });
  } catch (err) {
    console.error('Error in /api/meetings:', err);
    res.status(500).json({ error: 'Failed to create or fetch meeting' });
  }
});

app.post('/api/meetings/:meetingId/participants', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const participant = await db.addMeetingParticipant(meetingId, req.user.id);
    res.json({ participant });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

app.post('/api/meetings/:meetingId/transcripts', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { speakerName, text } = req.body;
    
    if (!speakerName || !text) {
      return res.status(400).json({ error: 'Speaker name and text are required' });
    }

    const transcript = await db.saveTranscript(meetingId, speakerName, text);
    res.json({ transcript });
  } catch (error) {
    console.error('Save transcript error:', error);
    res.status(500).json({ error: 'Failed to save transcript' });
  }
});

app.get('/api/meetings/:meetingId/transcripts', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const transcripts = await db.getMeetingTranscript(meetingId);
    res.json({ transcripts });
  } catch (error) {
    console.error('Get transcripts error:', error);
    res.status(500).json({ error: 'Failed to get transcripts' });
  }
});

// Get all meetings for a user
app.get('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const meetings = await db.getUserMeetings(req.user.id);
    res.json({ meetings });
  } catch (error) {
    console.error('Get user meetings error:', error);
    res.status(500).json({ error: 'Failed to get meetings' });
  }
});

// Get all transcripts for a user
app.get('/api/transcripts', authenticateToken, async (req, res) => {
  try {
    const transcripts = await db.getUserTranscripts(req.user.id);
    res.json({ transcripts });
  } catch (error) {
    console.error('Get user transcripts error:', error);
    res.status(500).json({ error: 'Failed to get transcripts' });
  }
});

// Save document (use authenticated user)
app.post('/api/meetings/:meetingId/documents', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
    const document = await db.saveDocument(meetingId, userId, title, content);
    res.json({ document });
  } catch (err) {
    console.error('Error saving document:', err);
    res.status(500).json({ error: 'Failed to save document' });
  }
});

// Get all documents for a user (use authenticated user)
app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const documents = await db.getUserDocuments(userId);
    res.json({ documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete a document by ID
app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    // Only allow deleting user's own documents
    const result = await db.deleteDocument(id, userId);
    if (result && result.deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found or not authorized' });
    }
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Delete a meeting by meetingId (host only)
app.delete('/api/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const result = await db.deleteMeeting(meetingId, userId);
    if (result && result.success) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: result.error || 'Not authorized or meeting not found' });
    }
  } catch (err) {
    console.error('Error deleting meeting:', err);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await db.connect();
    console.log('Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Default admin credentials: admin@meetdoc.com / admin123`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  db.close();
  process.exit(0);
}); 