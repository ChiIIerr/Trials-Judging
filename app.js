// --- FIREBASE CONFIGURATION ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAorpn0WBflUPKyx59iudTRDJ3tY2CYi9U",
  authDomain: "trials-cheaters-test.firebaseapp.com",
  projectId: "trials-cheaters-test",
  storageBucket: "trials-cheaters-test.firebasestorage.app",
  messagingSenderId: "532094831864",
  appId: "1:532094831864:web:ec2a5ecf36a1f9ab34bf0d",
  measurementId: "G-7H5XJZ7M9F"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variable to hold the current player's data
let currentPlayer = null;

// --- SUBMISSION LOGIC (for submit.html) ---

async function submitLink() {
    const linkInput = document.getElementById('trials-link-input');
    const statusEl = document.getElementById('submit-status');
    const trialsLink = linkInput.value.trim();

    // Basic validation to ensure it's a trials.report link
    if (!trialsLink.startsWith("https://trials.report/report/")) {
        statusEl.textContent = "Error: Please enter a valid Trials Report URL.";
        return;
    }

    statusEl.textContent = "Submitting...";

    try {
        // We need a unique ID for our database document. The player's membershipType
        // and membershipId from the URL are perfect for this.
        // Example URL: https://trials.report/report/3/4611686018467347034
        // We want to extract "3/4611686018467347034"
        const urlParts = trialsLink.split('/');
        if (urlParts.length < 5) throw new Error("Invalid URL format.");
        
        // The unique ID will be the last two parts of the URL path
        const uniqueId = `${urlParts[urlParts.length - 2]}-${urlParts[urlParts.length - 1]}`;

        // Add the player link to Firestore using our extracted uniqueId
        await db.collection('players').doc(uniqueId).set({
            trialsLink: trialsLink,
            votes_cheater: 0,
            votes_legit: 0,
            submitted_at: new Date()
        }, { merge: true }); // Use merge to not overwrite votes if re-submitted

        statusEl.textContent = `Success! The link has been added to the review queue.`;
        linkInput.value = '';

    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    }
}

// --- JUDGMENT LOGIC (for index.html) ---

async function loadRandomPlayer() {
    // Show loading state and hide old data
    document.getElementById('loading').style.display = 'block';
    document.getElementById('player-card').style.display = 'none';
    document.getElementById('results').style.display = 'none';

    // Fetch all players from Firestore
    const snapshot = await db.collection('players').get();
    if (snapshot.empty) {
        document.getElementById('loading').textContent = "No players in the queue. Submit a link!";
        return;
    }

    // Pick a random player document
    const players = snapshot.docs;
    const randomDoc = players[Math.floor(Math.random() * players.length)];
    currentPlayer = { id: randomDoc.id, ...randomDoc.data() };

    // This is now much simpler: just render the link.
    renderPlayerCard(currentPlayer);
}

function renderPlayerCard(playerData) {
    // Get the link element and set its href attribute
    const linkDisplay = document.getElementById('player-link-display');
    linkDisplay.href = playerData.trialsLink;

    // Show the card
    document.getElementById('loading').style.display = 'none';
    document.getElementById('player-card').style.display = 'block';
    
    // Make sure voting buttons are enabled and results are hidden
    document.getElementById('vote-cheater').disabled = false;
    document.getElementById('vote-legit').disabled = false;
    document.getElementById('results').style.display = 'none';
}

async function castVote(voteType) {
    // Disable buttons to prevent double-voting
    document.getElementById('vote-cheater').disabled = true;
    document.getElementById('vote-legit').disabled = true;

    const fieldToIncrement = `votes_${voteType}`;

    const playerRef = db.collection('players').doc(currentPlayer.id);
    await playerRef.update({
        [fieldToIncrement]: firebase.firestore.FieldValue.increment(1)
    });

    showResults();
}

async function showResults() {
    // Get the fresh data after our vote
    const updatedDoc = await db.collection('players').doc(currentPlayer.id).get();
    const data = updatedDoc.data();

    const cheaterVotes = data.votes_cheater;
    const legitVotes = data.votes_legit;
    const totalVotes = cheaterVotes + legitVotes;
    const confidence = totalVotes === 0 ? 0 : (cheaterVotes / totalVotes * 100);

    document.getElementById('confidence-level').textContent = 
        `Confidence Level: ${confidence.toFixed(1)}% believe this player is cheating.`;
    document.getElementById('vote-counts').textContent = 
        `Based on ${totalVotes} votes (${cheaterVotes} for cheater, ${legitVotes} for legit).`;

    document.getElementById('results').style.display = 'block';
}
