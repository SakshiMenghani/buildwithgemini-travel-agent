// Roam AI Agent - Frontend JavaScript App

document.addEventListener('DOMContentLoaded', () => {
  // Dynamic API Base URL determination (handles direct Cloud Run, local port 8000, and VS Code Live Server)
  const isLocalhost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  let API_BASE = '';
  if (isLocalhost) {
    API_BASE = (window.location.port === '8000') ? '' : 'http://127.0.0.1:8000';
  } else if (!window.location.hostname.includes('run.app')) {
    // If opened via VS Code Live Server / proxy / file protocol on a remote VM
    API_BASE = 'https://roam-app-659236617792.us-central1.run.app';
  }

  // App State
  let currentItinerary = null;
  let activeDayIndex = 0;
  let userPreferences = null;

  // DOM Element References
  const brandHome = document.getElementById('brand-home');
  const welcomeSection = document.getElementById('welcome-section');
  const tripDashboard = document.getElementById('trip-dashboard');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingTitle = document.getElementById('loading-title');

  // Modals
  const modalTripBuilder = document.getElementById('modal-trip-builder');
  const modalPreferences = document.getElementById('modal-preferences');

  // Buttons & Inputs
  const btnNewTrip = document.getElementById('btn-new-trip');
  const btnPreferences = document.getElementById('btn-preferences');
  const btnQuickPlan = document.getElementById('btn-quick-plan');
  const quickPromptInput = document.getElementById('quick-prompt');
  const tripBuilderForm = document.getElementById('trip-builder-form');
  const preferencesForm = document.getElementById('preferences-form');
  const replanInput = document.getElementById('replan-input');
  const btnSubmitReplan = document.getElementById('btn-submit-replan');

  // Modal Closers
  document.getElementById('close-builder-modal').addEventListener('click', () => hideModal(modalTripBuilder));
  document.getElementById('cancel-builder-modal').addEventListener('click', () => hideModal(modalTripBuilder));
  document.getElementById('close-pref-modal').addEventListener('click', () => hideModal(modalPreferences));
  document.getElementById('cancel-pref-modal').addEventListener('click', () => hideModal(modalPreferences));

  // Initialize
  loadUserPreferences();

  // Navigation: Return to Main Menu on Brand Click
  brandHome.addEventListener('click', () => {
    returnToMainMenu();
  });

  function returnToMainMenu() {
    tripDashboard.classList.add('hidden');
    welcomeSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Event Listeners
  btnNewTrip.addEventListener('click', () => {
    showModal(modalTripBuilder);
  });

  btnPreferences.addEventListener('click', () => {
    showModal(modalPreferences);
  });

  // Sample prompt chips on welcome screen
  document.querySelectorAll('.popular-destinations .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      quickPromptInput.value = prompt;
      generateItineraryFromPrompt(prompt);
    });
  });

  // Quick Plan Button Submit (Supports both plain destination or full prompt)
  btnQuickPlan.addEventListener('click', () => {
    const text = quickPromptInput.value.trim();
    if (!text) {
      alert('Please enter a destination or describe your trip prompt.');
      return;
    }
    
    // Check if it's a detailed prompt vs single city name
    if (text.length > 25 || text.includes('day') || text.includes('under') || text.includes('trip') || text.includes('with')) {
      generateItineraryFromPrompt(text);
    } else {
      openBuilderWithDestination(text);
    }
  });

  quickPromptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      btnQuickPlan.click();
    }
  });

  function openBuilderWithDestination(dest) {
    document.getElementById('modal-destination').value = dest;
    showModal(modalTripBuilder);
  }

  // Trip Builder Form Submit
  tripBuilderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideModal(modalTripBuilder);

    const destination = document.getElementById('modal-destination').value.trim();
    const startDate = document.getElementById('modal-start-date').value;
    const endDate = document.getElementById('modal-end-date').value;
    const budget = document.getElementById('modal-budget').value;
    const pace = document.getElementById('modal-pace').value;
    const customNotes = document.getElementById('modal-notes').value;

    const interests = [];
    document.querySelectorAll('#interest-checkboxes input[type="checkbox"]:checked').forEach(cb => {
      interests.push(cb.value);
    });

    const requestData = {
      destination,
      start_date: startDate,
      end_date: endDate,
      budget,
      pace,
      interests: interests.length > 0 ? interests : ["Culture", "Foodie"],
      custom_notes: customNotes,
      preferences: userPreferences
    };

    await generateItinerary(requestData);
  });

  // User Profile Badge Click
  const userProfileBadge = document.getElementById('user-profile-badge');
  if (userProfileBadge) {
    userProfileBadge.addEventListener('click', () => {
      showModal(modalPreferences);
    });
  }

  // Avatar Picker Selection
  let selectedAvatar = 'female_1';
  document.querySelectorAll('#avatar-picker .avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#avatar-picker .avatar-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedAvatar = opt.getAttribute('data-avatar');
    });
  });

  // Voice Agent: Speech Recognition (Speech-to-Text)
  setupVoiceRecognition('mic-quick-prompt', 'quick-prompt');
  setupVoiceRecognition('mic-replan-input', 'replan-input');

  function setupVoiceRecognition(buttonId, targetInputId) {
    const btn = document.getElementById(buttonId);
    const targetInput = document.getElementById(targetInputId);
    if (!btn || !targetInput) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btn.title = "Speech Recognition not supported in this browser.";
      btn.style.opacity = '0.5';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let isListening = false;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isListening) {
        recognition.start();
      } else {
        recognition.stop();
      }
    });

    recognition.onstart = () => {
      isListening = true;
      btn.classList.add('listening');
      btn.title = "Listening... Speak your prompt now";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (targetInput.value) {
        targetInput.value += " " + transcript;
      } else {
        targetInput.value = transcript;
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };

    function stopListening() {
      isListening = false;
      btn.classList.remove('listening');
      btn.title = "Click to speak using Voice";
    }
  }

  // AI Avatar Companion Widget Interaction Logic
  const aiAvatarWidget = document.getElementById('ai-avatar-widget');
  const btnMinimizeAvatar = document.getElementById('btn-minimize-avatar');
  const btnLiveVoiceChat = document.getElementById('btn-live-voice-chat');
  const btnStopAvatarVoice = document.getElementById('btn-stop-avatar-voice');
  const selectAiPersona = document.getElementById('select-ai-persona');
  const aiAvatarImg = document.getElementById('ai-avatar-img');

  let isAvatarSessionActive = false;
  let avatarRecognition = null;

  // Minimize / Expand Avatar Widget
  if (btnMinimizeAvatar) {
    btnMinimizeAvatar.addEventListener('click', () => {
      aiAvatarWidget.classList.toggle('minimized');
      const icon = btnMinimizeAvatar.querySelector('i');
      if (aiAvatarWidget.classList.contains('minimized')) {
        icon.className = 'fa-solid fa-chevron-up';
      } else {
        icon.className = 'fa-solid fa-chevron-down';
      }
    });
  }

  // Persona Selector
  if (selectAiPersona) {
    selectAiPersona.addEventListener('change', (e) => {
      const p = e.target.value;
      const avatarMap = {
        'bot_1': 'https://api.dicebear.com/7.x/bottts/svg?seed=RoamAI',
        'female_2': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria&gender=female',
        'male_1': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Atlas&gender=male'
      };
      aiAvatarImg.src = avatarMap[p] || avatarMap['bot_1'];
    });
  }

  function setAvatarState(state, text = '') {
    const ring = document.getElementById('avatar-status-ring');
    const eq = document.getElementById('avatar-audio-equalizer');
    const speechText = document.getElementById('avatar-speech-text');

    if (text && speechText) {
      speechText.textContent = `"${text}"`;
    }

    if (ring) {
      ring.className = `avatar-status-ring ${state}`;
    }

    if (eq) {
      if (state === 'speaking') {
        eq.classList.remove('hidden');
      } else {
        eq.classList.add('hidden');
      }
    }
  }

  function speakAvatarResponse(text, onEndCallback = null) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    setAvatarState('speaking', text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onstart = () => {
      setAvatarState('speaking', text);
    };

    utterance.onend = () => {
      setAvatarState('idle', "Ready for your next request!");
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      setAvatarState('idle');
    };

    window.speechSynthesis.speak(utterance);
  }

  // Talk Live with AI Avatar Button
  const btnHeroTalkAvatar = document.getElementById('btn-hero-talk-avatar');
  if (btnHeroTalkAvatar) {
    btnHeroTalkAvatar.addEventListener('click', () => {
      aiAvatarWidget.classList.remove('minimized');
      startLiveVoiceSession();
    });
  }

  if (btnLiveVoiceChat) {
    btnLiveVoiceChat.addEventListener('click', () => {
      startLiveVoiceSession();
    });
  }

  if (btnStopAvatarVoice) {
    btnStopAvatarVoice.addEventListener('click', () => {
      stopLiveVoiceSession();
    });
  }

  function startLiveVoiceSession() {
    isAvatarSessionActive = true;
    btnLiveVoiceChat.classList.add('hidden');
    btnStopAvatarVoice.classList.remove('hidden');

    const userName = (userPreferences && userPreferences.user_name) ? userPreferences.user_name : 'Sakshi';
    const introText = `Hi ${userName}! I am Roam, your live AI travel agent. Where would you like to travel next?`;

    speakAvatarResponse(introText, () => {
      if (isAvatarSessionActive) {
        listenToUserVoice();
      }
    });
  }

  function stopLiveVoiceSession() {
    isAvatarSessionActive = false;
    btnLiveVoiceChat.classList.remove('hidden');
    btnStopAvatarVoice.classList.add('hidden');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (avatarRecognition) {
      try { avatarRecognition.stop(); } catch (e) {}
    }
    setAvatarState('idle', "Voice session ended. Speak or click to start again!");
  }

  function listenToUserVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      stopLiveVoiceSession();
      return;
    }

    setAvatarState('listening', "Listening to you... Speak now!");

    avatarRecognition = new SpeechRecognition();
    avatarRecognition.continuous = false;
    avatarRecognition.interimResults = false;
    avatarRecognition.lang = 'en-US';

    avatarRecognition.onresult = async (event) => {
      const userSpokenPrompt = event.results[0][0].transcript;
      setAvatarState('thinking', `Processing: "${userSpokenPrompt}"...`);

      if (currentItinerary && (userSpokenPrompt.includes('replan') || userSpokenPrompt.includes('change') || userSpokenPrompt.includes('rain') || userSpokenPrompt.includes('replace') || userSpokenPrompt.includes('day'))) {
        await triggerReplan(userSpokenPrompt);
        speakAvatarResponse(`I have updated your itinerary based on: ${userSpokenPrompt}. Take a look!`);
      } else {
        await generateItineraryFromPrompt(userSpokenPrompt);
        if (currentItinerary) {
          speakAvatarResponse(`I have crafted your trip to ${currentItinerary.destination}! ${currentItinerary.summary}`);
        }
      }
    };

    avatarRecognition.onerror = (err) => {
      console.warn("Avatar speech recognition error:", err);
      setAvatarState('idle', "Sorry, I didn't catch that. Click Talk Live to try again!");
    };

    avatarRecognition.onend = () => {
      if (isAvatarSessionActive && document.getElementById('avatar-status-ring').classList.contains('listening')) {
        setAvatarState('idle', "Ready!");
      }
    };

    avatarRecognition.start();
  }

  // Voice Agent: Text-to-Speech (Audio Narration)
  const btnVoiceSpeak = document.getElementById('btn-voice-speak');
  let isSpeaking = false;

  if (btnVoiceSpeak) {
    btnVoiceSpeak.addEventListener('click', () => {
      toggleVoiceNarration();
    });
  }

  function toggleVoiceNarration() {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-Speech narration is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      btnVoiceSpeak.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>Listen to Itinerary</span>`;
      btnVoiceSpeak.classList.remove('btn-danger');
      btnVoiceSpeak.classList.add('btn-accent');
      setAvatarState('idle', "Ready!");
      return;
    }

    if (!currentItinerary) return;

    let textToSpeak = `Trip to ${currentItinerary.destination}. ${currentItinerary.summary}. `;
    if (currentItinerary.days && currentItinerary.days.length > 0) {
      const day1 = currentItinerary.days[0];
      textToSpeak += `Day 1 theme: ${day1.theme}. `;
      day1.activities.slice(0, 2).forEach(act => {
        textToSpeak += `${act.time_slot}: ${act.title}. ${act.description}. `;
      });
    }

    speakAvatarResponse(textToSpeak);
  }

  // API Call: Save Preferences
  preferencesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideModal(modalPreferences);

    const dietaryStr = document.getElementById('pref-dietary').value;
    const dietaryList = dietaryStr ? dietaryStr.split(',').map(s => s.trim()) : [];

    userPreferences = {
      user_name: document.getElementById('pref-user-name').value.trim() || 'Sakshi',
      user_avatar: selectedAvatar,
      personality_type: document.getElementById('pref-personality').value.trim() || 'Culture Enthusiast & Foodie Explorer',
      dietary_restrictions: dietaryList,
      travel_pace: document.getElementById('pref-pace').value,
      preferred_transport: document.getElementById('pref-transport').value,
      saved_notes: document.getElementById('pref-notes').value,
      budget_level: "Moderate",
      interests: ["Culture", "Foodie"],
      accessibility_needs: [],
      past_destinations: (userPreferences && userPreferences.past_destinations) ? userPreferences.past_destinations : []
    };

    try {
      const res = await fetch(`${API_BASE}/api/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPreferences)
      });
      if (res.ok) {
        userPreferences = await res.json();
        updateUserProfileUI(userPreferences);
        alert('Travel Memory Profile saved successfully!');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
    }
  });

  // API Call: Load User Preferences
  async function loadUserPreferences() {
    try {
      const res = await fetch(`${API_BASE}/api/preferences`);
      if (res.ok) {
        userPreferences = await res.json();
        if (userPreferences) {
          updateUserProfileUI(userPreferences);
        }
      }
    } catch (err) {
      console.warn('Preferences load error:', err);
    }
  }

  function updateUserProfileUI(prefs) {
    if (!prefs) return;
    document.getElementById('header-user-name').textContent = prefs.user_name || 'Sakshi';
    document.getElementById('pref-user-name').value = prefs.user_name || 'Sakshi';
    document.getElementById('pref-personality').value = prefs.personality_type || 'Culture Enthusiast & Foodie Explorer';
    document.getElementById('pref-dietary').value = (prefs.dietary_restrictions || []).join(', ');
    document.getElementById('pref-pace').value = prefs.travel_pace || 'Balanced';
    document.getElementById('pref-transport').value = prefs.preferred_transport || 'Public Transit / Walking';
    document.getElementById('pref-notes').value = prefs.saved_notes || '';

    // Update Avatar UI
    selectedAvatar = prefs.user_avatar || 'female_1';
    const avatarUrlMap = {
      'female_1': 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(prefs.user_name || 'Sakshi'),
      'female_2': 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(prefs.user_name || 'Sakshi') + '&gender=female',
      'male_1': 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&gender=male',
      'bot_1': 'https://api.dicebear.com/7.x/bottts/svg?seed=RoamAI'
    };

    const avatarSrc = avatarUrlMap[selectedAvatar] || avatarUrlMap['female_1'];
    document.getElementById('header-user-avatar').src = avatarSrc;

    document.querySelectorAll('#avatar-picker .avatar-option').forEach(opt => {
      opt.classList.remove('selected');
      if (opt.getAttribute('data-avatar') === selectedAvatar) {
        opt.classList.add('selected');
      }
    });

    // Update Past Trip Memory Badges
    const pastBox = document.getElementById('past-destinations-box');
    if (pastBox) {
      pastBox.innerHTML = '';
      const pastList = prefs.past_destinations || [];
      if (pastList.length === 0) {
        pastBox.innerHTML = '<span class="text-muted" style="font-size: 0.85rem;">No past trip history recorded yet.</span>';
      } else {
        pastList.forEach(dest => {
          const badge = document.createElement('span');
          badge.className = 'memory-badge';
          badge.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${escapeHtml(dest)}`;
          pastBox.appendChild(badge);
        });
      }
    }
  }

  // API Call: Generate Itinerary from Natural Language Prompt
  async function generateItineraryFromPrompt(promptText) {
    showLoading('Roam AI is analyzing your prompt...', `Extracting destination, dates, budget & interests with Gemini`);
    try {
      const res = await fetch(`${API_BASE}/api/itinerary/from-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, preferences: userPreferences })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errorText}`);
      }

      currentItinerary = await res.json();
      activeDayIndex = 0;
      renderItineraryDashboard(currentItinerary);
    } catch (err) {
      alert(`Error generating itinerary: ${err.message}`);
      console.error('Itinerary generation error:', err);
    } finally {
      hideLoading();
    }
  }

  // API Call: Generate Itinerary from Structured Form
  async function generateItinerary(requestData) {
    showLoading('Roam AI is crafting your trip...', `Grounded places & itinerary for ${requestData.destination}`);
    try {
      const res = await fetch(`${API_BASE}/api/itinerary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!res.ok) {
        throw new Error('Failed to generate itinerary.');
      }

      currentItinerary = await res.json();
      activeDayIndex = 0;
      renderItineraryDashboard(currentItinerary);
    } catch (err) {
      alert('Error generating itinerary. Please try again.');
      console.error(err);
    } finally {
      hideLoading();
    }
  }

  // API Call: Dynamic Re-plan
  async function triggerReplan(promptText) {
    if (!currentItinerary) return;
    showLoading('Roam AI is re-planning your trip...', `Updating itinerary based on: "${promptText}"`);

    const replanPayload = {
      trip_id: currentItinerary.trip_id,
      user_prompt: promptText,
      current_itinerary: currentItinerary,
      updated_preferences: userPreferences
    };

    try {
      const res = await fetch(`${API_BASE}/api/itinerary/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replanPayload)
      });

      if (!res.ok) throw new Error('Re-plan failed.');

      currentItinerary = await res.json();
      replanInput.value = '';
      renderItineraryDashboard(currentItinerary);
    } catch (err) {
      alert('Error re-planning itinerary.');
      console.error(err);
    } finally {
      hideLoading();
    }
  }

  // Render Itinerary Dashboard
  function renderItineraryDashboard(itinerary) {
    welcomeSection.classList.add('hidden');
    tripDashboard.classList.remove('hidden');

    document.getElementById('hero-img').src = itinerary.hero_image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80';
    document.getElementById('trip-title').textContent = itinerary.title;
    document.getElementById('trip-summary').textContent = itinerary.summary;
    document.getElementById('hero-dates').innerHTML = `<i class="fa-regular fa-calendar"></i> ${itinerary.dates}`;
    document.getElementById('hero-cost').innerHTML = `<i class="fa-solid fa-wallet"></i> ${itinerary.estimated_total_cost}`;

    const dayTabsContainer = document.getElementById('day-tabs');
    dayTabsContainer.innerHTML = '';

    itinerary.days.forEach((day, idx) => {
      const tab = document.createElement('div');
      tab.className = `day-tab ${idx === activeDayIndex ? 'active' : ''}`;
      tab.textContent = `Day ${day.day_number}`;
      tab.addEventListener('click', () => {
        activeDayIndex = idx;
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderActiveDayPlan(itinerary.days[activeDayIndex]);
      });
      dayTabsContainer.appendChild(tab);
    });

    renderActiveDayPlan(itinerary.days[activeDayIndex]);
  }

  // Render Active Day Activities
  function renderActiveDayPlan(dayPlan) {
    const container = document.getElementById('day-content-container');
    if (!dayPlan) {
      container.innerHTML = '<p>No details available for this day.</p>';
      return;
    }

    let html = `
      <div class="day-meta-card">
        <div>
          <div class="day-theme-title">Day ${dayPlan.day_number}: ${escapeHtml(dayPlan.theme)}</div>
        </div>
        <div class="day-weather-badge">
          <i class="fa-solid fa-cloud-sun"></i> ${escapeHtml(dayPlan.weather_forecast || 'Clear')}
        </div>
      </div>

      <div class="activities-timeline">
    `;

    dayPlan.activities.forEach(act => {
      const catClass = getCategoryClass(act.category);
      const placeImgUrl = act.image_url || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80';
      
      html += `
        <div class="activity-card">
          <div class="activity-img-col">
            <img src="${placeImgUrl}" alt="${escapeHtml(act.title)}" loading="lazy" />
          </div>

          <div class="activity-time-col">
            <span class="time-slot">${escapeHtml(act.time_slot)}</span>
            <span class="category-tag ${catClass}">${escapeHtml(act.category)}</span>
          </div>

          <div class="activity-main-col">
            <div class="activity-title-row">
              <h3 class="activity-title">${escapeHtml(act.title)}</h3>
              <span class="activity-rating">
                <i class="fa-solid fa-star"></i> ${act.rating || '4.8'}
              </span>
            </div>

            <p class="activity-desc">${escapeHtml(act.description)}</p>

            <div class="activity-footer-meta">
              <span class="activity-cost"><i class="fa-solid fa-tag"></i> ${escapeHtml(act.estimated_cost)}</span>
              <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(act.location_name)}</span>
              <a href="${act.google_maps_url}" target="_blank" rel="noopener" class="maps-link">
                View on Google Maps <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>

            ${act.tips ? `<div class="activity-tip-box"><i class="fa-solid fa-lightbulb"></i> <strong>Tip:</strong> ${escapeHtml(act.tips)}</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // Helper Utilities
  function getCategoryClass(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('attraction') || c.includes('sight')) return 'cat-attraction';
    if (c.includes('restaurant') || c.includes('food')) return 'cat-restaurant';
    if (c.includes('cafe') || c.includes('coffee')) return 'cat-cafe';
    if (c.includes('shop')) return 'cat-shopping';
    return 'cat-relaxation';
  }

  function showModal(modal) {
    modal.classList.remove('hidden');
  }

  function hideModal(modal) {
    modal.classList.add('hidden');
  }

  function showLoading(title, subtitle) {
    loadingTitle.textContent = title;
    document.getElementById('loading-subtitle').textContent = subtitle;
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
