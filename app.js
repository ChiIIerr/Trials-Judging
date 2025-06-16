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
    // ... submitLink function remains unchanged ...
    const linkInput = document.getElementById('trials-link-input');
    const statusEl = document.getElementById('submit-status');
    const trialsLink = linkInput.value.trim();

    if (!trialsLink.startsWith("https://trials.report/report/")) {
        statusEl.textContent = "Error: Please enter a valid Trials Report URL.";
        return;
    }
    statusEl.textContent = "Submitting...";
    try {
        const urlParts = trialsLink.split('/');
        if (urlParts.length < 5) throw new Error("Invalid URL format.");
        const uniqueId = `${urlParts[urlParts.length - 2]}-${urlParts[urlParts.length - 1]}`;
        await db.collection('players').doc(uniqueId).set({
            trialsLink: trialsLink,
            votes_cheater: 0,
            votes_legit: 0,
            submitted_at: new Date()
        }, { merge: true });
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

    // Get the list of player IDs the user has already voted on
    const votedIDs = JSON.parse(localStorage.getItem('votedPlayerIDs') || '[]');

    // Filter the full list of players down to only those the user has NOT voted on
    const availablePlayers = snapshot.docs.filter(doc => !votedIDs.includes(doc.id));

    // Handle the case where the user has voted on every single player
    if (availablePlayers.length === 0) {
        document.getElementById('loading').innerHTML = "Wow, you've voted on everyone!<br>Check back later for new submissions.";
        return;
    }

    // Pick a random player from the *available* (un-voted) list
    const randomDoc = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    currentPlayer = { id: randomDoc.id, ...randomDoc.data() };

    renderPlayerCard(currentPlayer);
}

function renderPlayerCard(playerData) {
    // ... renderPlayerCard function remains unchanged ...
    const linkDisplay = document.getElementById('player-link-display');
    linkDisplay.href = playerData.trialsLink;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('player-card').style.display = 'block';
    document.getElementById('vote-cheater').disabled = false;
    document.getElementById('vote-legit').disabled = false;
    document.getElementById('results').style.display = 'none';
}

async function castVote(voteType) {
    const cheaterButton = document.getElementById('vote-cheater');
    const legitButton = document.getElementById('vote-legit');
    cheaterButton.disabled = true;
    legitButton.disabled = true;

    try {
        const fieldToIncrement = `votes_${voteType}`;
        const playerRef = db.collection('players').doc(currentPlayer.id);
        
        await playerRef.update({
            [fieldToIncrement]: firebase.firestore.FieldValue.increment(1)
        });

        // Get the list of IDs the user has already voted on from localStorage
        const votedHistory = JSON.parse(localStorage.getItem('votedPlayerIDs') || '[]');
        
        // Add the ID of the player they just voted on
        if (!votedHistory.includes(currentPlayer.id)) {
            votedHistory.push(currentPlayer.id);
        }
        
        // Save the updated list back to localStorage
        localStorage.setItem('votedPlayerIDs', JSON.stringify(votedHistory));

        showResults();
    } catch (error) {
        console.error("Error casting vote:", error);
        alert("Could not cast vote. Check console for details.");
        cheaterButton.disabled = false;
        legitButton.disabled = false;
    }
}

function showResults() {
    // ... showResults function remains unchanged ...
    db.collection('players').doc(currentPlayer.id).get().then(updatedDoc => {
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
    });
}
