const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const multer = require('multer');
const { readState, addMarker, addImage } = require('./stateStore');

const app = express();
const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const authorizedDiscordIds = (process.env.AUTHORIZED_DISCORD_IDS || '276547936916078592')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const hasDiscordCredentials = Boolean(
  process.env.DISCORD_CLIENT_ID &&
  process.env.DISCORD_CLIENT_SECRET &&
  process.env.DISCORD_CALLBACK_URL,
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

if (hasDiscordCredentials) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL,
        scope: ['identify'],
      },
      (accessToken, refreshToken, profile, done) => {
        done(null, profile);
      },
    ),
  );
}

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === 'test') {
  app.use((req, _res, next) => {
    const testDiscordId = req.get('x-test-discord-id');
    if (testDiscordId) {
      req.user = { id: testDiscordId, username: 'test-user' };
    }
    next();
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${extension || '.png'}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype === 'image/png' && path.extname(file.originalname).toLowerCase() === '.png';
    cb(null, allowed);
  },
});

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!authorizedDiscordIds.includes(req.user.id)) {
    return res.status(403).json({ error: 'Discord user is not authorized' });
  }

  return next();
}

app.get('/auth/discord', (req, res, next) => {
  if (!hasDiscordCredentials) {
    return res.status(500).send('Discord OAuth is not configured on the server.');
  }

  return passport.authenticate('discord')(req, res, next);
});

app.get(
  '/auth/discord/callback',
  (req, res, next) => {
    if (!hasDiscordCredentials) {
      return res.status(500).send('Discord OAuth is not configured on the server.');
    }

    return passport.authenticate('discord', {
      failureRedirect: '/?login=failed',
    })(req, res, next);
  },
  (req, res) => {
    if (!authorizedDiscordIds.includes(req.user.id)) {
      req.logout(() => {
        res.redirect('/?login=unauthorized');
      });
      return;
    }

    res.redirect('/');
  },
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.status(204).send();
    });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, oauthConfigured: hasDiscordCredentials });
  }

  if (!authorizedDiscordIds.includes(req.user.id)) {
    return res.status(403).json({ authenticated: false, error: 'Discord user is not authorized' });
  }

  return res.json({
    authenticated: true,
    oauthConfigured: hasDiscordCredentials,
    user: {
      id: req.user.id,
      username: req.user.username,
      discriminator: req.user.discriminator,
      avatar: req.user.avatar,
    },
  });
});

app.get('/api/state', requireAuth, (_req, res) => {
  res.json(readState());
});

app.post('/api/markers', requireAuth, (req, res) => {
  const { lat, lng, label } = req.body;
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const marker = {
    id: Date.now().toString(),
    lat: latitude,
    lng: longitude,
    label: typeof label === 'string' ? label.trim().slice(0, 120) : '',
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  addMarker(marker);
  return res.status(201).json(marker);
});

app.post('/api/images', requireAuth, upload.single('image'), (req, res) => {
  const { lat, lng, label } = req.body;
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Only PNG images are accepted' });
  }

  const image = {
    id: Date.now().toString(),
    lat: latitude,
    lng: longitude,
    label: typeof label === 'string' ? label.trim().slice(0, 120) : '',
    imageUrl: `/uploads/${req.file.filename}`,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  addImage(image);
  return res.status(201).json(image);
});

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = { app, authorizedDiscordIds };
