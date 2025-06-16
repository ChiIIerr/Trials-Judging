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

async function submitPlayer() {
    const nameInput = document.getElementById('bungie-name-input');
    const statusEl = document.getElementById('submit-status');
    const bungieName = nameInput.value.trim();

    if (!bungieName.includes('#')) {
        statusEl.textContent = "Error: Please use the full Bungie Name (e.g., Guardian#1234).";
        return;
    }

    statusEl.textContent = "Submitting...";

    try {
        // Call our serverless function to validate the player and get their ID
        // Replace with your actual Netlify function URL
        const response = await fetch(`/.netlify/functions/get-player-stats?name=${encodeURIComponent(bungieName)}`);
        const data = await response.json();

        if (response.status !== 200) throw new Error(data.error);

        // Add the player to Firestore using their unique membershipId as the document ID
        await db.collection('players').doc(data.membershipId).set({
            bungieName: data.bungieName,
            membershipType: data.membershipType,
            votes_cheater: 0,
            votes_legit: 0,
            submitted_at: new Date()
        }, { merge: true }); // Use merge to avoid overwriting existing votes if re-submitted

        statusEl.textContent = `Success! ${data.bungieName} has been added to the review queue.`;
        nameInput.value = '';

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
        document.getElementById('loading').textContent = "No players in the queue. Submit one!";
        return;
    }

    // Pick a random player
    const players = snapshot.docs;
    const randomDoc = players[Math.floor(Math.random() * players.length)];
    currentPlayer = { id: randomDoc.id, ...randomDoc.data() };

    // Fetch up-to-date stats using our serverless proxy
    try {
        const response = await fetch(`/.netlify/functions/get-player-stats?name=${encodeURIComponent(currentPlayer.bungieName)}`);
        const data = await response.json();
        
        if (response.status !== 200) throw new Error(data.error);
        
        // We got the stats, now render the card
        renderPlayerCard(data);

    } catch(error) {
        document.getElementById('loading').textContent = `Error loading player data: ${error.message}`;
    }
}

function renderPlayerCard(playerData) {
    // Extract stats (the structure depends heavily on the Bungie API response)
    const trialsStats = playerData.stats.trialsOfOsiris.allTime;
    const kd = trialsStats ? trialsStats.efficiency.basic.displayValue : 'N/A';
    const winRate = trialsStats ? (trialsStats.activitiesWon.basic.value / trialsStats.activitiesEntered.basic.value * 100).toFixed(2) + '%' : 'N/A';

    // Display basic stats
    document.getElementById('player-name').textContent = playerData.bungieName;
    const statsContainer = document.getElementById('player-stats');
    statsContainer.innerHTML = `
        <p><strong>Trials K/D:</strong> ${kd}</p>
        <p><strong>Trials Win Rate:</strong> ${winRate}</p>
    `;

    // Display external links
    const linksContainer = document.getElementById('player-links');
    linksContainer.innerHTML = `
        <a href="https://destinytracker.com/destiny-2/profile/bungie/${playerData.membershipId}" target="_blank">DestinyTracker Profile</a> |
        <a href="https://trials.report/report/${playerData.membershipType}/${playerData.membershipId}" target="_blank">Trials Report</a>
    `;

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

    // The field to increment in Firestore is 'votes_cheater' or 'votes_legit'
    const fieldToIncrement = `votes_${voteType}`;

    // Use Firestore's atomic increment operation
    const playerRef = db.collection('players').doc(currentPlayer.id);
    await playerRef.update({
        [fieldToIncrement]: firebase.firestore.FieldValue.increment(1)
    });

    // Show the results
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
