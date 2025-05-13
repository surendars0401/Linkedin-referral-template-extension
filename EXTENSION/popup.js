document.addEventListener('DOMContentLoaded', () => {
    const convertBtn = document.getElementById('convertBtn');
    const copyBtn = document.getElementById('copyBtn');
    const outputTextArea = document.getElementById('output');
    const statusPara = document.getElementById('status');

    let profileData = null; // To store fetched data

    // --- Request data from content script as soon as popup opens ---
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // Check if the active tab is a LinkedIn profile page
        if (tabs[0]?.url && tabs[0].url.includes("linkedin.com/in/")) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getProfileData" }, (response) => {
                if (chrome.runtime.lastError) {
                    // Handle potential errors (e.g., content script not ready)
                    statusPara.textContent = "Error: Could not connect to page. Refresh?";
                    console.error("Error sending message:", chrome.runtime.lastError.message);
                    convertBtn.disabled = true;
                    return;
                }

                if (response && response.name && response.company) {
                    profileData = response; // Store the data
                    statusPara.textContent = "Profile data loaded. Ready to convert.";
                    convertBtn.disabled = false;
                } else {
                    statusPara.textContent = "Could not find name/company on page.";
                    console.warn("Incomplete data received:", response);
                    convertBtn.disabled = true;
                }
            });
        } else {
             statusPara.textContent = "Not on a LinkedIn profile page.";
             convertBtn.disabled = true;
        }
    });

    // --- Convert Button Logic ---
    convertBtn.addEventListener('click', () => {
        if (!profileData) {
            statusPara.textContent = "No profile data available.";
            return;
        }

        const name = profileData.name;
        const company = profileData.company;

        // --- *** THE MESSAGE TEMPLATE *** ---
        const message = `Hi ${name}, I came across an opening at ${company} that matches my skills. I have nearly two years of experience in embedded software development. Looking forward to your response`;
        // --- *** END TEMPLATE *** ---

        outputTextArea.value = message;
        outputTextArea.readOnly = false; // Allow potential manual edits if needed
        copyBtn.classList.remove('hidden'); // Show the copy button
        statusPara.textContent = "Message generated.";
    });

    // --- Copy Button Logic ---
    copyBtn.addEventListener('click', () => {
        outputTextArea.select(); // Select the text
        outputTextArea.setSelectionRange(0, 99999); // For mobile devices (just in case)

        try {
            navigator.clipboard.writeText(outputTextArea.value)
                .then(() => {
                    copyBtn.textContent = 'Copied!';
                    statusPara.textContent = "Message copied to clipboard!";
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy Text';
                    }, 1500); // Reset button text after 1.5 seconds
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    statusPara.textContent = "Failed to copy. Try manual copy.";
                });
        } catch (err) {
            console.error('Clipboard API not available or failed: ', err);
            statusPara.textContent = "Copy failed. Please copy manually.";
            // Fallback for older browsers or secure contexts might be needed here,
            // but navigator.clipboard is standard in modern extensions.
        }
    });
});