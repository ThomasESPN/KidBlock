document.addEventListener('DOMContentLoaded', () => {
    const profileSelector = document.getElementById('profileSelector');
    const newProfileInput = document.getElementById('newProfile');
    const profileTypeSelect = document.getElementById('profileType');
    const addProfileBtn = document.getElementById('addProfileBtn');
    const deleteProfileBtn = document.getElementById('deleteProfileBtn');
    const addUrlBtn = document.getElementById('addUrlBtn');
    const newUrlInput = document.getElementById('newUrl');
    const searchUrlInput = document.getElementById('searchUrlInput'); // Champ de recherche
    const blacklist = document.getElementById('blacklist');
    let selectedProfile = "default";

    // Function to load the default blacklist from blacklist.txt
    function loadDefaultBlacklist(callback) {
        fetch('data/blacklist.txt')
            .then(response => response.text())
            .then(data => {
                const urls = data.split('\n').map(url => url.trim()).filter(url => url);
                callback(urls);
            })
            .catch(error => console.error('Error loading blacklist:', error));
    }

    // Function to create a profile with a type and blacklist
    function createProfile(profileName, profileType) {
        if (profileType === 'child') {
            loadDefaultBlacklist((defaultBlacklist) => {
                const blacklistWithTimes = defaultBlacklist.map(url => ({ url, screenTime: 0 }));
                chrome.storage.sync.set({
                    [profileName]: {
                        type: profileType,
                        blacklist: blacklistWithTimes
                    }
                }, () => {
                    console.log(`Child profile ${profileName} added with a default blacklist.`);
                    displayProfiles();
                    newProfileInput.value = '';  // Reset input field
                });
            });
        } else {
            chrome.storage.sync.set({
                [profileName]: {
                    type: profileType,
                    blacklist: []
                }
            }, () => {
                console.log(`Adult profile ${profileName} added.`);
                displayProfiles();
                newProfileInput.value = '';  // Reset input field
            });
        }
    }

    // Function to display the list of profiles in a dropdown
    function displayProfiles() {
        chrome.storage.sync.get(null, (result) => {
            profileSelector.innerHTML = '';  // Clear the dropdown
            const profiles = Object.keys(result).filter(key => key !== "currentProfile");
            profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile;
                option.textContent = `${profile} (${result[profile].type})`;
                profileSelector.appendChild(option);
            });

            // Automatically select the first profile or the current one
            chrome.storage.sync.get(['currentProfile'], (result) => {
                const currentProfile = result.currentProfile || profiles[0];
                profileSelector.value = currentProfile;
                displayBlacklistForProfile(currentProfile); // Display the blacklist for this profile
            });
        });
    }

    // Function to display the blacklist of the selected profile
    function displayBlacklistForProfile(profileName, searchTerm = '') {
        chrome.storage.sync.get([profileName], (result) => {
            const profileData = result[profileName];
            blacklist.innerHTML = '';  // Clear the current blacklist display
            profileData.blacklist.forEach((entry) => {
                if (entry.url.includes(searchTerm)) {
                    const li = document.createElement('li');
                    li.textContent = entry.url;
                    blacklist.appendChild(li);
                }
            });
        });
    }

    // Function to search an URL in the blacklist
    searchUrlInput.addEventListener('input', () => {
        const searchTerm = searchUrlInput.value.trim();
        const selectedProfile = profileSelector.value;
        displayBlacklistForProfile(selectedProfile, searchTerm);
    });

    // Function to delete the selected profile
    function deleteProfile(profileName) {
        chrome.storage.sync.remove(profileName, () => {
            console.log(`Profile ${profileName} deleted.`);
            displayProfiles();  // Refresh the profile list after deletion
        });
    }

    // Function to add a new URL to the blacklist for the selected profile
    function addUrlToBlacklist(profileName, newUrl) {
        chrome.storage.sync.get([profileName], (result) => {
            const profileData = result[profileName] || { blacklist: [] };
            profileData.blacklist.push({ url: newUrl });

            // Save the updated profile with the new blacklist
            chrome.storage.sync.set({
                [profileName]: profileData
            }, () => {
                console.log(`URL ${newUrl} added to the blacklist for profile ${profileName}.`);
                displayBlacklistForProfile(profileName);  // Refresh the blacklist display
                newUrlInput.value = '';  // Clear the URL input field

                // Notify background.js to update blocking rules
                chrome.runtime.sendMessage({
                    action: 'changeProfile',
                    profile: profileName
                });
            });
        });
    }

    // Event handler for adding a new profile
    addProfileBtn.addEventListener('click', () => {
        const profileName = newProfileInput.value.trim();
        const profileType = profileTypeSelect.value;
        if (profileName) {
            createProfile(profileName, profileType);
        } else {
            alert("Profile name cannot be empty.");
        }
    });

    // Event handler for deleting a selected profile
    deleteProfileBtn.addEventListener('click', () => {
        const selectedProfile = profileSelector.value;
        if (confirm(`Voulez-vous vraiment supprimer le profil ${selectedProfile} ?`)) {
            deleteProfile(selectedProfile);
        }
    });

    // Event handler for adding a new URL to the blacklist
    addUrlBtn.addEventListener('click', () => {
        const newUrl = newUrlInput.value.trim();
        const selectedProfile = profileSelector.value;
        if (newUrl) {
            addUrlToBlacklist(selectedProfile, newUrl);
        } else {
            alert("L'URL ne peut pas être vide.");
        }
    });

    // Event handler for when the profile is changed in the dropdown
    profileSelector.addEventListener('change', () => {
        const selectedProfile = profileSelector.value;
        chrome.storage.sync.set({ currentProfile: selectedProfile }, () => {
            displayBlacklistForProfile(selectedProfile); // Display the blacklist for this profile
            // Notify background.js to update blocking rules
            chrome.runtime.sendMessage({
                action: 'changeProfile',
                profile: selectedProfile
            });
        });
    });

    // Initialize by displaying the profiles and their blacklists
    displayProfiles();
});
