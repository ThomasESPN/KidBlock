document.addEventListener('DOMContentLoaded', () => {
    const addProfileBtn = document.getElementById('addProfileBtn');
    const newProfileInput = document.getElementById('newProfile');
    const profileTypeSelect = document.getElementById('profileType');
    const profileSelector = document.getElementById('profileSelector'); // For SelectProfile tab
    const manageProfileSelector = document.getElementById('manageProfileSelector'); // For Gestion de profil tab
    const blacklist = document.getElementById('manageBlacklist'); // For displaying blacklist in Gestion de profil tab
    const changeProfileBtn = document.getElementById('changeProfileBtn');

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
                    alert(`Profil enfant ${profileName} créé`);
                    updateProfileList();
                    newProfileInput.value = '';  // Clear input
                });
            });
        } else {
            chrome.storage.sync.set({
                [profileName]: {
                    type: profileType,
                    blacklist: []
                }
            }, () => {
                alert(`Profil adulte ${profileName} créé.`);
                updateProfileList();
                newProfileInput.value = '';  // Clear input
            });
        }
    }

    // Function to display the list of profiles in the dropdowns (SelectProfile and Gestion de profil)
    function updateProfileList() {
        chrome.storage.sync.get(null, (result) => {
            const profiles = Object.keys(result).filter(key => key !== "currentProfile");

            // Update the profileSelector in "Sélectionner un profil" tab
            profileSelector.innerHTML = '';  // Clear the dropdown
            profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile;
                option.textContent = `${profile} (${result[profile].type})`;
                profileSelector.appendChild(option);
            });

            // Update the manageProfileSelector in "Gestion de profil" tab
            manageProfileSelector.innerHTML = '';  // Clear the dropdown
            profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile;
                option.textContent = `${profile} (${result[profile].type})`;
                manageProfileSelector.appendChild(option);
            });

            chrome.storage.sync.get('currentProfile', (result) => {
                const currentProfile = result.currentProfile || profiles[0];  // Default to the first profile
                profileSelector.value = currentProfile;  // Select the current profile in the dropdown
            });
        });
    }

    // Function to display the blacklist for the selected profile
    function displayBlacklistForProfile(profileName) {
        chrome.storage.sync.get([profileName], (result) => {
            const profileData = result[profileName];
            blacklist.innerHTML = '';  // Clear the current blacklist display
            if (profileData && profileData.blacklist.length > 0) {
                profileData.blacklist.forEach((entry) => {
                    const li = document.createElement('li');
                    li.textContent = entry.url;
                    blacklist.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                blacklist.appendChild(li);
            }
        });
    }

    // Function to block the URLs based on the blacklist of the selected profile
    function blockUrlsForProfile(profileName) {
        chrome.storage.sync.get([profileName], (result) => {
            const profileData = result[profileName];
            if (profileData && profileData.blacklist.length > 0) {
                const blockedUrls = profileData.blacklist.map((entry, index) => ({
                    id: index + 1,
                    action: { type: 'block' },
                    condition: { urlFilter: entry.url, resourceTypes: ['main_frame'] }
                }));

                // Remove any existing rules before applying new ones
                chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: [...Array(100).keys()], // Remove all existing rules (up to 100)
                    addRules: blockedUrls
                }, () => {
                    console.log(`Blocking rules applied for profile ${profileName}`);
                });
            } else {
                // Clear the rules if no blacklist is present
                chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: [...Array(100).keys()] // Remove all existing rules
                }, () => {
                    console.log(`No blacklist, clearing blocking rules for profile ${profileName}`);
                });
            }
        });
    }

    function saveCurrentProfile(profileName) {
        chrome.storage.sync.set({ currentProfile: profileName }, () => {
            console.log(`Profile ${profileName} saved as the current profile.`);
        });
    }
    // Event handler for adding a new profile
    addProfileBtn.addEventListener('click', () => {
        const profileName = newProfileInput.value.trim();
        const profileType = profileTypeSelect.value;
        if (profileName) {
            createProfile(profileName, profileType);
        } else {
            alert("Le nom du profil ne peut pas être vide.");
        }
    });

    // Event handler for when a profile is selected in "Gestion de profil" tab
    manageProfileSelector.addEventListener('change', () => {
        const selectedProfile = manageProfileSelector.value;
        displayBlacklistForProfile(selectedProfile);  // Display the blacklist for the selected profile
        blockUrlsForProfile(selectedProfile);  // Apply the blocking rules for the selected profile
    });

    changeProfileBtn.addEventListener('click', () => {
        const selectedProfile = profileSelector.value;
        
        // Envoyer un message au background pour changer le profil et mettre à jour les règles
        chrome.runtime.sendMessage({
            action: 'changeProfile',
            profile: selectedProfile
        }, (response) => {
            if (response.success) {
                alert(`Profil ${selectedProfile} sélectionné.`);
            } else {
                alert(`Erreur lors du changement de profil : ${response.error}`);
            }
        });
    });
    
    // Initialize by displaying the profiles and setting up default values
    updateProfileList();

    // Handle tab switching
    function openTab(evt, tabName) {
        // Hide all tab content
        const tabcontent = document.getElementsByClassName("tabcontent");
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }

        // Remove the active class from all tab buttons
        const tablinks = document.getElementsByClassName("tablinks");
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }

        // Show the clicked tab content and set the clicked tab to active
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    }

    // Add click listeners to all tab buttons
    document.getElementById('selectProfileTab').addEventListener('click', (evt) => openTab(evt, 'SelectProfile'));
    document.getElementById('manageProfileTab').addEventListener('click', (evt) => openTab(evt, 'ManageProfile'));
    document.getElementById('screenTimeTab').addEventListener('click', (evt) => openTab(evt, 'ScreenTime'));

    // Automatically open the "Select Profile" tab on popup load
    function openDefaultTab() {
        document.getElementById('selectProfileTab').click();
    }

    openDefaultTab(); // Open the default tab on load
});
