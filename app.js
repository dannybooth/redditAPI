require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session'); // For managing sessions
const app = express();

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const redirectUri = process.env.REDDIT_REDIRECT_URI;

app.use(express.static('public'));

// Setup session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Root route
app.get('/', (req, res) => {
    res.send('<h1>Reddit OAuth Example</h1><a href="/auth/reddit">Login with Reddit</a>');
});

// OAuth authorization route
app.get('/auth/reddit', (req, res) => {
    const state = 'random_state_string';  // Replace with a unique state string for each request
    const scope = 'read';  // Ensure this is a valid scope
    const redditAuthUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=temporary&scope=${scope}`;
    
    res.redirect(redditAuthUrl);
});

// OAuth callback route
app.get('/auth/reddit/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        res.send('Error: No code returned from Reddit');
        return;
    }

    try {
        const response = await axios.post('https://www.reddit.com/api/v1/access_token', new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
        }), {
            auth: {
                username: clientId,
                password: clientSecret
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const tokenData = response.data;

        // Save the access token in the session
        req.session.accessToken = tokenData.access_token;

        // Redirect to the subreddit posts page
        res.redirect('/subreddit');
    } catch (error) {
        console.error('Error fetching access token:', error);
        res.send('Error fetching access token');
    }
});

// Route to display posts from a specific subreddit
app.get('/subreddit', (req, res) => {
    res.sendFile(__dirname + '/subreddit.html'); // Serve a specific HTML file for subreddit display
});

// Fetch Reddit posts from a specific subreddit using access token
app.get('/api/subreddit-posts', async (req, res) => {
    const accessToken = req.session.accessToken;
    const subreddit = 'javascript'; // Replace with your desired subreddit

    if (!accessToken) {
        res.status(401).send('Unauthorized: No access token found');
        return;
    }

    try {
        const response = await axios.get(`https://oauth.reddit.com/r/${subreddit}/top?limit=5`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'YourAppName/0.1 by YourRedditUsername'
            }
        });

        const posts = response.data.data.children.map(post => ({
            title: post.data.title,
            description: post.data.selftext || 'No description available',  // Text body of the post
            upvotes: post.data.ups,
            downvotes: post.data.downs,
            permalink: post.data.permalink,
            author: post.data.author,
            subreddit: post.data.subreddit
        }));

        res.json(posts);
    } catch (error) {
        console.error('Error fetching subreddit posts:', error);
        res.status(500).send('Error fetching subreddit posts');
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});