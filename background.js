let currentProfile = null;

// Function to load the current profile and apply the blocking rules
function updateBlockingRules(profileName) {
    if (!profileName) {
        console.error("Invalid profile name passed to updateBlockingRules.");
        return;
    }

    console.log(`Updating blocking rules for profile: ${profileName}`);

    // Get the profile data from storage
    chrome.storage.sync.get([profileName], (result) => {
        let profileData = result[profileName];

        // If profile not found, create a default one
        if (!profileData) {
            console.warn(`Profile ${profileName} not found. Creating a default profile.`);
            profileData = {
                type: 'adult', // Default type can be adult or child
                blacklist: []
            };
            chrome.storage.sync.set({ [profileName]: profileData }, () => {
                console.log(`Default profile ${profileName} created.`);
            });
        }

        // Clear existing rules before applying new ones
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [...Array(100).keys()] // Clear all existing rules
        }, () => {
            console.log(`Cleared previous blocking rules for profile: ${profileName}`);

            // Apply new blocking rules if the profile is of type 'child' and has a blacklist
            if (profileData.type === 'child' && profileData.blacklist && profileData.blacklist.length > 0) {
                const blockedUrls = profileData.blacklist.map((entry, index) => ({
                    id: index + 1,
                    action: { type: 'block' },
                    condition: { urlFilter: `*://*${entry.url}*`, resourceTypes: ['main_frame'] }
                }));

                chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: blockedUrls
                }, () => {
                    console.log(`Blocking rules applied for child profile: ${profileName}`);
                });
            } else {
                // No blocking rules for adult profile
                console.log(`No blocking rules applied for adult profile or empty blacklist.`);
            }
        });
    });
}

// Listening for profile change and updating rules dynamically
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "changeProfile") {
        const profileName = message.profile;
        console.log(`Profile switch requested to: ${profileName}`);

        if (!profileName) {
            console.error("No profile name provided in message.");
            sendResponse({ success: false, error: "No profile name provided." });
            return;
        }

        // Save the current profile in storage and update blocking rules
        chrome.storage.sync.set({ currentProfile: profileName }, () => {
            updateBlockingRules(profileName);
            sendResponse({ success: true });
        });
    }
});

// Load the current profile on extension install or update
function loadCurrentProfile() {
    chrome.storage.sync.get(['currentProfile'], (result) => {
        const profileName = result.currentProfile || "default";
        currentProfile = profileName;
        updateBlockingRules(profileName);
    });
}

// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(['default'], (result) => {
        if (!result.default) {
            // Create default profile if it doesn't exist
            chrome.storage.sync.set({
                default: {
                    type: 'adult', // You can change this to 'child' if needed
                    blacklist: []
                }
            }, () => {
                console.log("Default profile created on installation.");
            });
        }
        loadCurrentProfile();
    });
});
