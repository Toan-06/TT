require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const chatRoutes = require('./routes/chat');
const placesRoutes = require('./routes/places');
const { router: authRoutes } = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const feedbackRoutes = require('./routes/feedback');

app.use('/api/chat', chatRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);

// Fallback for SPA or unknown routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    // Vẫn chạy server kể cả khi không có DB cho mục đích demo UI
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT} (without MongoDB)`);
    });
  });
